"use client";

import { useMemo } from "react";
import {
  buildProductWhatsAppHref,
  type WhatsAppProductMessageInput,
} from "@/lib/whatsapp/buildWhatsAppProductMessage";
import { resolveSellerWhatsAppNumber } from "@/lib/whatsapp/normalizeWhatsAppNumber";

export type ProductSellerContact = {
  name: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  whatsapp_url?: string | null;
};

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.85 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function ChatWithSellerButton({
  seller,
  messageInput,
  disabled,
}: {
  seller: ProductSellerContact;
  messageInput: WhatsAppProductMessageInput;
  disabled?: boolean;
}) {
  const phone = useMemo(
    () =>
      resolveSellerWhatsAppNumber({
        whatsapp_number: seller.whatsapp_number,
        phone: seller.phone,
        whatsapp_url: seller.whatsapp_url,
      }),
    [seller.whatsapp_number, seller.phone, seller.whatsapp_url]
  );

  const href = useMemo(() => {
    if (disabled || !phone) return null;
    return buildProductWhatsAppHref({
      seller: {
        whatsapp_number: seller.whatsapp_number,
        phone: seller.phone,
        whatsapp_url: seller.whatsapp_url,
      },
      messageInput,
    });
  }, [
    disabled,
    phone,
    seller.whatsapp_number,
    seller.phone,
    seller.whatsapp_url,
    messageInput,
  ]);

  if (!phone) {
    return (
      <p className="mt-4 text-center text-xs text-[#6e6e73]">
        Seller WhatsApp is not available for this product right now.
      </p>
    );
  }

  if (!href || disabled) {
    return (
      <button
        type="button"
        disabled
        className="mt-3 w-full py-4 rounded-full font-semibold text-lg flex items-center justify-center gap-2 border-2 border-[#d2d2d7] text-[#6e6e73] bg-white cursor-not-allowed"
      >
        <WhatsAppGlyph className="w-5 h-5" />
        Chat with Seller
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        try {
          // Fire-and-forget; never block WhatsApp open
          if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag("event", "product_whatsapp_chat_clicked", {
              product_name: messageInput.productName,
              store_name: seller.name,
            });
          }
        } catch {
          /* ignore */
        }
      }}
      className="mt-3 w-full py-4 rounded-full font-semibold text-lg flex items-center justify-center gap-2 border-2 border-[#25D366]/40 text-[#128C7E] bg-[#25D366]/10 hover:bg-[#25D366]/18 hover:border-[#25D366]/60 transition-all"
      aria-label={`Chat with ${seller.name || "seller"} on WhatsApp about ${messageInput.productName}`}
    >
      <WhatsAppGlyph className="w-5 h-5 text-[#25D366]" />
      Chat with Seller
    </a>
  );
}
