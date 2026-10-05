'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Send,
  Loader2,
  ArrowLeft,
  X,
  Bot,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type PublicProduct } from '@/lib/api-client';

export default function ProductsCatalogPage() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Inquiry form modal state
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const data = await api.public.getProducts();
        setProducts(data);
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const handleOpenInquiry = (prod: PublicProduct) => {
    setSelectedProduct(prod);
    setMessage(`I am interested in acquiring or customizing the "${prod.title}" solution.`);
    setShowInquiryModal(true);
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await api.public.submitInquiry({
        name,
        email,
        company: company || undefined,
        message,
        productSlug: selectedProduct?.slug,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowInquiryModal(false);
        setName('');
        setEmail('');
        setCompany('');
        setMessage('');
        setSelectedProduct(null);
      }, 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['ALL', 'AI_AUTOMATION', 'FULLSTACK_APP', 'AGENT_PIPELINE'];

  const filteredProducts = products.filter(
    (p) => activeCategory === 'ALL' || p.category === activeCategory,
  );

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-[#07090e]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Showcase Home</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition-colors">
              Platform Console
            </Link>
            <Button
              size="sm"
              onClick={() => {
                setSelectedProduct(null);
                setMessage('');
                setShowInquiryModal(true);
              }}
              className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20"
            >
              <Send className="h-3 w-3" />
              <span>Custom Quote</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        {/* Page Title & Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Consultancy &amp; Bespoke Architecture
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineering Solutions &amp; Strategic Engagements
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            High-leverage engineering engagements, autonomous AI pipelines, and production full-stack systems delivered by Ghulam Ghaus (GG IT SOLUTIONS) for businesses in Saudi Arabia, UAE, and globally.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-xs">Loading solutions catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Filter className="h-8 w-8 mx-auto text-slate-600" />
            <p className="text-sm">No offerings found under this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className="p-6 rounded-3xl bg-card/25 border border-white/5 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-6 relative group"
              >
                {prod.badge && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px] font-mono">
                      {prod.badge}
                    </Badge>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Bot className="h-4 w-4" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      {prod.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{prod.title}</h3>
                  {prod.tagline && (
                    <p className="text-xs font-medium text-indigo-300">{prod.tagline}</p>
                  )}
                  <p className="text-xs text-slate-400 leading-relaxed">{prod.description}</p>

                  {/* Feature list */}
                  <div className="space-y-1.5 pt-4 border-t border-white/5">
                    {prod.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Engagement Scope</span>
                    <span className="text-sm font-semibold text-indigo-300 font-mono">
                      {prod.priceUsd ? `From $${prod.priceUsd.toLocaleString()}` : 'Custom Milestone'}
                    </span>
                  </div>

                  <Button
                    onClick={() => handleOpenInquiry(prod)}
                    className="w-full text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl gap-1.5 shadow-md shadow-indigo-500/20"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Inquire / Request Consultation</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#0d111a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {selectedProduct ? `Inquire about ${selectedProduct.title}` : 'Solution Consultation'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Discuss implementation requirements, timeline, and architectural fit.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInquiryModal(false)}
                className="h-7 w-7 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {success ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="font-semibold text-sm text-white">Inquiry Received</h4>
                <p className="text-xs text-slate-400">
                  Thank you! We have received your consultation request and will reach out promptly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Michael Chen"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. michael@fintech.io"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. CloudScale Systems"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Project Scope &amp; Needs *</label>
                  <textarea
                    required
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe specific timelines, tech requirements, or features..."
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInquiryModal(false)}
                    className="text-xs h-8 border-white/10 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="text-xs h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 shadow-md shadow-indigo-500/20"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Submit Request</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
