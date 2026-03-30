import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PSE_SYMBOLS = [
  "MBT", "GLO", "DMC", "FILRT", "KEEPR", "MREIT", "RRHI",
  "BDO", "BPI", "TEL", "AC", "ALI", "RLC", "AREIT", "DDMPR",
  "CREIT", "SCC", "ICT", "SECB"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const symbols = PSE_SYMBOLS.map(s => `${s}.PS`).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose,regularMarketVolume,shortName`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance error: ${res.status}`);
    }

    const data = await res.json();
    const quotes = data?.quoteResponse?.result || [];

    const prices: Record<string, {
      symbol: string;
      price: number | null;
      change_pct: number | null;
      prev_close: number | null;
      volume: number | null;
      name: string | null;
      updated_at: string;
    }> = {};

    for (const q of quotes) {
      const sym = q.symbol?.replace(".PS", "");
      if (!sym) continue;
      prices[sym] = {
        symbol: sym,
        price: q.regularMarketPrice ?? null,
        change_pct: q.regularMarketChangePercent ?? null,
        prev_close: q.regularMarketPreviousClose ?? null,
        volume: q.regularMarketVolume ?? null,
        name: q.shortName ?? null,
        updated_at: new Date().toISOString(),
      };
    }

    return new Response(JSON.stringify({ prices, count: Object.keys(prices).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
