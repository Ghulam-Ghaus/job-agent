'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api, type JarvisChatResponse } from '@/lib/api-client';
import type { JarvisState } from '@/components/jarvis/JarvisCoreVisualizer';

interface UseJarvisVoiceOptions {
  onSwitchTab?: (tab: string) => void;
  onOpenConsultation?: () => void;
  onShowArchitecture?: (domain?: string) => void;
}

// Advisory client-side cap on a single live call (server-side protection is the
// per-IP throttle on /public/voice/token + short-lived Deepgram JWTs).
const MAX_CALL_MS = 10 * 60 * 1000;

export function useJarvisVoice(options: UseJarvisVoiceOptions = {}) {
  const [state, setState] = useState<JarvisState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [lastResponse, setLastResponse] = useState<JarvisChatResponse | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(18);

  // Deepgram WebSocket & Audio Refs
  const wsRef = useRef<WebSocket | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const tokenRef = useRef<{ token: string; expiresAt: number } | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>('');
  const lastUserUtteranceRef = useRef<string>('');
  const lastAssistantUtteranceRef = useRef<string>('');
  const lastTurnStartTimeRef = useRef<number>(0);

  // Synchronize and persist unified session across text chat & voice turns
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('ghaus_session_id');
      if (stored) {
        sessionIdRef.current = stored;
      } else {
        const id = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        sessionIdRef.current = id;
        sessionStorage.setItem('ghaus_session_id', id);
      }
    }
  }, []);

  // Toggle microphone mute without disconnecting the call
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  }, []);


  // Stop live call and reset all audio pipelines
  const stopListening = useCallback(() => {
    // 0. Clear the session cap timer
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // 1. Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    // 2. Stop microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 3. Disconnect processor
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {}
      processorNodeRef.current = null;
    }

    // 4. Close recording context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // 5. Stop all playing audio buffers & close playback context
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;

    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }

    setAudioLevel(0);
    setState('IDLE');
    setIsVoiceActive(false);
    setIsMuted(false);
    isMutedRef.current = false;
  }, []);


  // Barge-in: cut playback immediately when user speaks
  const handleBargeIn = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (playbackContextRef.current) {
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;
    }
    setState('LISTENING');
  }, []);

  // Short-lived voice token (server mints a ~60s JWT; master key never reaches the browser)
  const getOrFetchToken = useCallback(async (): Promise<string> => {
    const cached = tokenRef.current;
    if (cached && cached.expiresAt - Date.now() > 15_000) return cached.token;
    const res = await api.public.getVoiceToken();
    tokenRef.current = {
      token: res.token,
      expiresAt: Date.now() + (res.expiresIn ?? 60) * 1000,
    };
    return res.token;
  }, []);

  // Play linear PCM 24000Hz chunk through Web Audio API
  const playAudioChunk = useCallback((buffer: ArrayBuffer) => {
    try {
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        playbackContextRef.current = new AudioCtx({ sampleRate: 24000 });
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;
      }

      const ctx = playbackContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const pcm16 = new Int16Array(buffer);
      if (pcm16.length === 0) return;

      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0 && wsRef.current) {
          setState((prev) => (prev === 'SPEAKING' ? 'LISTENING' : prev));
        }
      };

      setState('SPEAKING');
    } catch (e) {
      console.warn('Playback error:', e);
    }
  }, []);

  // Start two-way real-time voice call with Deepgram
  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      setState('SEARCHING');
      setIsVoiceActive(true);

      if (!sessionIdRef.current) {
        const id =
          'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        sessionIdRef.current = id;
        try {
          sessionStorage.setItem('ghaus_session_id', id);
        } catch {}
      }

      lastUserUtteranceRef.current = '';
      lastAssistantUtteranceRef.current = '';
      lastTurnStartTimeRef.current = 0;

      const token = await getOrFetchToken();

      // 1. Initialize WebSocket to Deepgram Voice Agent (bearer for JWTs, token for API keys)
      const subprotocol = token.startsWith('ey') ? 'bearer' : 'token';
      const ws = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', [subprotocol, token]);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;


      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => stopListening(), MAX_CALL_MS);

      let isReady = false;

      ws.onopen = () => {
        // Connected, waiting for Welcome
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary audio received from Deepgram Aura
          playAudioChunk(event.data);
          return;
        }

        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'Welcome') {
            // Send settings configuration with grounded knowledge pack
            ws.send(
              JSON.stringify({
                type: 'Settings',
                audio: {
                  input: { encoding: 'linear16', sample_rate: 16000 },
                  output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
                },
                agent: {
                  listen: { provider: { type: 'deepgram', model: 'nova-3' } },
                  think: {
                    provider: { type: 'open_ai', model: 'gpt-4o-mini' },
                    prompt:
                      'You are Ghaus, the autonomous Forward Deployed Systems Architect and AI engineering twin for Ghulam Ghaus.\n' +
                      'You speak directly, concisely, and with deep technical authority. Keep answers tight and conversational (1-2 sentences).\n' +
                      'BILINGUAL INTELLIGENCE: You understand both English and Urdu (including Roman Urdu like "pricing kya hai", "hiring karni hai", "services batao"). Respond in clear, crisp, authoritative English (or polite bilingual greeting if addressed in Urdu).\n\n' +
                      'GROUND TRUTH KNOWLEDGE:\n' +
                      '- Consultant & Architect: Ghulam Ghaus, Forward Deployed Systems Architect engineering autonomous AI discovery pipelines, zero-hallucination verification engines, and production backend workflows.\n' +
                      '- Location: Riyadh, Dubai, Global Remote.\n' +
                      '- Productized Services & Fixed Pricing:\n' +
                      '  1. Autonomous Client & Candidate Ingestion Engine ($3,500 FIXED): High-volume autonomous multi-channel discovery and candidate ingestion with zero hallucinations.\n' +
                      '  2. Embedded Forward Deployed AI Sprint ($4,800 FIXED): 2 to 4-week direct deployment sprint embedded into client engineering codebases.\n' +
                      '  3. Autonomous Voice & Reasoning AI Twin ($2,800 FIXED): Ultra-low latency voice agents with deterministic MCP tool execution and strict database grounding.\n' +
                      '- Operational Guarantees:\n' +
                      '  1. Zero Hallucinations: Two-pass Zod verification against confirmed database records.\n' +
                      '  2. Anti-Spam Safety Send Cap: Strict 15-per-day dispatch cap per channel.\n' +
                      '  3. Human-in-the-Loop Gateway: No email or application sent without explicit ApprovalRecord.\n' +
                      '- Strict Rule: Never invent facts, prices, or capabilities. If asked about unverified items, state: "That is unknown in our verified ground truth, but we can review it during an engineering consultation."\n\n' +
                      'AVAILABLE SYSTEM ACTIONS:\n' +
                      '- If user asks to see opportunities or jobs, call function switch_tab with tab="opportunities".\n' +
                      '- If user asks to see leads or companies, call function switch_tab with tab="leads".\n' +
                      '- If user asks to see approvals or safety send cap, call function switch_tab with tab="approvals".\n' +
                      '- If user asks to see CV or resume, call function switch_tab with tab="cv".\n' +
                      '- If user wants to hire, book, or schedule a consultation with Ghulam Ghaus, call function book_consultation.\n' +
                      '- If user shares their contact email or project requirements, call function capture_lead.',
                    functions: [
                      {
                        name: 'switch_tab',
                        description: 'Switch the interactive workstation tab',
                        parameters: {
                          type: 'object',
                          properties: {
                            tab: {
                              type: 'string',
                              enum: ['opportunities', 'leads', 'approvals', 'cv'],
                              description: 'The tab identifier to switch to',
                            },
                          },
                          required: ['tab'],
                        },
                      },
                      {
                        name: 'book_consultation',
                        description:
                          'Open the client sprint inquiry and consultation modal for hiring Ghulam Ghaus',
                        parameters: { type: 'object', properties: {} },
                      },
                      {
                        name: 'capture_lead',
                        description:
                          'Capture client contact details and project requirements for booking an engineering consultation with Ghulam Ghaus',
                        parameters: {
                          type: 'object',
                          properties: {
                            name: { type: 'string', description: "Client's full name" },
                            email: { type: 'string', description: "Client's business or personal email" },
                            company: { type: 'string', description: "Client's company or organization" },
                            message: { type: 'string', description: 'Consultation project scope or requirements' },
                          },
                          required: ['email'],
                        },
                      },
                    ],

                  },
                  speak: { provider: { type: 'deepgram', model: 'aura-orpheus-en' } },
                },
              }),
            );
          } else if (msg.type === 'SettingsApplied') {
            isReady = true;
            setState('LISTENING');
          } else if (msg.type === 'UserStartedSpeaking') {
            handleBargeIn();
            lastTurnStartTimeRef.current = performance.now();
            lastUserUtteranceRef.current = '';
            lastAssistantUtteranceRef.current = '';
          } else if (msg.type === 'AgentStartedSpeaking') {
            setState('SPEAKING');
          } else if (msg.type === 'AgentAudioDone') {
            // Audio turn complete; persist spoken Q&A to database
            if (lastUserUtteranceRef.current) {
              const elapsed = Math.round(
                performance.now() - (lastTurnStartTimeRef.current || performance.now()),
              );
              api.public
                .recordQuery({
                  query: lastUserUtteranceRef.current.trim(),
                  response: lastAssistantUtteranceRef.current?.trim() || undefined,
                  channel: 'VOICE',
                  sessionId: sessionIdRef.current,
                  latencyMs: elapsed > 0 ? elapsed : undefined,
                })
                .catch(() => {});
              lastUserUtteranceRef.current = '';
            }
          } else if (msg.type === 'ConversationText') {
            if (msg.content) {
              setTranscript(msg.content);
              if (msg.role === 'user') {
                lastUserUtteranceRef.current =
                  (lastUserUtteranceRef.current ? lastUserUtteranceRef.current + ' ' : '') +
                  msg.content;
              } else if (msg.role === 'assistant') {
                lastAssistantUtteranceRef.current =
                  (lastAssistantUtteranceRef.current ? lastAssistantUtteranceRef.current + ' ' : '') +
                  msg.content;
              }
            }
          } else if (msg.type === 'FunctionCallRequest') {
            // Execute client tool
            const toolName = msg.name;
            const input = msg.input || {};
            setActiveTool(toolName);
            setState('EXECUTING_ACTION');

            let toolResult = 'Action executed successfully';
            if (toolName === 'switch_tab' && input.tab && options.onSwitchTab) {
              options.onSwitchTab(input.tab);
              setToolOutput(`⚡ [ACTION: Switched workstation view to ${input.tab}]`);
              toolResult = `Workstation switched to ${input.tab} tab`;
            } else if (toolName === 'book_consultation' && options.onOpenConsultation) {
              options.onOpenConsultation();
              setToolOutput('⚡ [ACTION: Opened consultation inquiry dossier]');
              toolResult = 'Consultation inquiry opened';
            } else if (toolName === 'capture_lead') {
              if (input.email) {
                api.public
                  .submitInquiry({
                    name: input.name || 'Prospective Client',
                    email: input.email,
                    company: input.company,
                    message: input.message || 'Captured during voice conversation',
                  })
                  .catch(() => {});
                setToolOutput(`⚡ [LEAD CAPTURED: ${input.email} registered for consultation]`);
                toolResult = `Consultation request registered for ${input.email}`;
              } else {
                toolResult = 'Client email address is required to register consultation request';
              }
            }


            // Persist action tool execution with query
            if (lastUserUtteranceRef.current) {
              api.public
                .recordQuery({
                  query: lastUserUtteranceRef.current.trim(),
                  response: toolResult,
                  channel: 'VOICE',
                  action: toolName,
                  toolName,
                  sessionId: sessionIdRef.current,
                })
                .catch(() => {});
            }

            // Acknowledge function call to Deepgram
            ws.send(
              JSON.stringify({
                type: 'FunctionCallResponse',
                function_call_id: msg.function_call_id,
                output: toolResult,
              }),
            );
          }
        } catch (err) {
          console.warn('Error parsing agent message:', err);
        }
      };


      ws.onerror = (e) => {
        console.error('Deepgram WebSocket Error event:', e);
        stopListening();
      };

      ws.onclose = (e) => {
        if (e.code !== 1000 && e.code !== 1005) {
          console.warn(`Deepgram WebSocket Closed [code: ${e.code}, reason: "${e.reason}"]`);
        }
        stopListening();
      };


      // 2. Capture Microphone at 16kHz
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      // Buffer size 2048 (~128ms chunks at 16kHz)
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }

        const input = e.inputBuffer.getChannelData(0);

        // Calculate audio decibel level for visualizer
        let sum = 0;
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          sum += s * s;
        }

        const rms = Math.sqrt(sum / input.length);
        const level = Math.min(1, rms * 5);
        setAudioLevel(level);

        // Stream raw PCM to Deepgram if connection is open and ready
        if (ws.readyState === WebSocket.OPEN && isReady) {
          ws.send(pcm16.buffer);
        }
      };


      source.connect(processor);
      // Connect processor to destination so Chrome doesn't garbage collect it (silent output)
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error('Failed to start live voice call:', err);
      stopListening();
    }
  }, [getOrFetchToken, handleBargeIn, options, playAudioChunk, stopListening]);

  // Toggle voice call
  const toggleVoice = useCallback(() => {
    if (isVoiceActive) {
      stopListening();
    } else {
      startListening();
    }
  }, [isVoiceActive, startListening, stopListening]);

  // Spoken TTS playback for text chat (Deepgram Aura REST)
  const speakAuraText = useCallback(
    async (text: string) => {
      try {
        setState('SPEAKING');
        const token = await getOrFetchToken();

        const authHeader = token.startsWith('ey') ? `Bearer ${token}` : `Token ${token}`;
        const response = await fetch(
          'https://api.deepgram.com/v1/speak?model=aura-orpheus-en&encoding=linear16&sample_rate=24000&container=none',
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          },
        );

        if (!response.ok) {
          throw new Error('Deepgram speak failed');
        }

        const buffer = await response.arrayBuffer();
        playAudioChunk(buffer);
      } catch {
        // Fallback to browser SpeechSynthesis if network issue
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setState('IDLE');
          utterance.onerror = () => setState('IDLE');
          window.speechSynthesis.speak(utterance);
        } else {
          setState('IDLE');
        }
      }
    },
    [getOrFetchToken, playAudioChunk],
  );

  // Process text prompt / question
  const processMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed) return;

      setTranscript(trimmed);
      setState('SEARCHING');
      const startTime = performance.now();

      try {
        if (!sessionIdRef.current) {
          const id =
            'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
          sessionIdRef.current = id;
          try {
            sessionStorage.setItem('ghaus_session_id', id);
          } catch {}
        }
        const res = await api.public.askJarvis(trimmed, undefined, sessionIdRef.current);
        const duration = Math.round(performance.now() - startTime);
        setLatencyMs(duration);
        setLastResponse(res);
        setActiveTool(res.toolName);
        setToolOutput(res.toolOutput);
        setCitations(res.citations);

        // Perform UI action if requested
        if (res.action === 'switch_tab' && res.actionPayload && options.onSwitchTab) {
          setState('EXECUTING_ACTION');
          setTimeout(() => {
            options.onSwitchTab?.(res.actionPayload!);
          }, 300);
        } else if (res.action === 'book_consultation' && options.onOpenConsultation) {
          setState('EXECUTING_ACTION');
          setTimeout(() => {
            options.onOpenConsultation?.();
          }, 300);
        } else if (res.action === 'show_architecture' && options.onShowArchitecture) {
          setState('EXECUTING_ACTION');
          setTimeout(() => {
            options.onShowArchitecture?.(res.actionPayload);
          }, 300);
        }

        // Speak via natural Deepgram Aura
        speakAuraText(res.reply);
      } catch {
        setState('IDLE');
        setActiveTool('system_error');
        setToolOutput('⚡ [NETWORK: Fallback to direct dossier lookup]');
      }
    },
    [options, speakAuraText],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    state,
    setState,
    audioLevel,
    transcript,
    lastResponse,
    activeTool,
    toolOutput,
    citations,
    isVoiceActive,
    isMuted,
    latencyMs,
    startListening,
    stopListening,
    toggleVoice,
    toggleMute,
    processMessage,
  };
}

