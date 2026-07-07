"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  attachWidgetInvoice,
  getWidgetParams,
  loadMonoPayScript,
  type MonoPayError,
} from "@/lib/monopay-widget";

/**
 * Офіційна кнопка monoPay (JS-віджет Monobank) для кроку оплати.
 *
 * Флоу:
 *  1. Бекенд віддає підписані параметри (keyId/signature/requestId/payloadBase64).
 *  2. Віджет малює кнопку; клік → QR-код (десктоп) або відкриття застосунку
 *     monobank (мобільний; без застосунку — веб-версія).
 *  3. onInvoiceCreate → прив'язуємо інвойс до платіжної сесії кошика.
 *  4. Оплата → onSuccess → перехід на /checkout/payment-return, де замовлення
 *     завершується ПІСЛЯ серверної перевірки (webhook + звірка статусу) — колбеку
 *     фронтенда ніколи не довіряємо як фінальному підтвердженню.
 *
 * Якщо віджет не сконфігуровано на сервері (немає ключів) або скрипт не
 * завантажився — компонент викликає onUnavailable(), і чекаут показує
 * стандартну кнопку з переходом на hosted-сторінку оплати.
 */
export function MonoPayWidgetButton({
  cartId,
  saveCard,
  onUnavailable,
}: {
  cartId: string;
  saveCard: boolean;
  onUnavailable: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // The widget is a global singleton — remember whether THIS component owns it.
  const initializedRef = useRef(false);
  const saveCardRef = useRef(saveCard);

  const handleError = useCallback((error: MonoPayError) => {
    setStatus("error");
    setErrorMsg(
      error?.message || error?.description || "Не вдалося виконати оплату. Спробуйте ще раз."
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const params = await getWidgetParams(cartId, saveCardRef.current);
        if (cancelled) return;
        if (!params) {
          onUnavailable();
          return;
        }

        const MonoPay = await loadMonoPayScript();
        if (cancelled) return;

        const { button } = MonoPay.init({
          ...params,
          ui: {
            buttonType: "pay",
            theme: "dark",
            corners: "rounded",
          },
          callbacks: {
            onButtonReady: () => {
              if (!cancelled) setStatus("ready");
            },
            onClick: () => {
              setErrorMsg(null);
            },
            onInvoiceCreate: async (data) => {
              // Прив'язка інвойса до сесії — критично зробити ДО завершення
              // оплати, інакше замовлення не зможе завершитися.
              const attached = await attachWidgetInvoice(cartId, data.invoiceId);
              if (!attached) {
                handleError({
                  message:
                    "Не вдалося зареєструвати платіж. Оновіть сторінку та спробуйте ще раз.",
                });
              }
            },
            onSuccess: () => {
              // Статус завжди підтверджується сервером: payment-return полить
              // бекенд (який звіряє інвойс через API + отримує webhook).
              window.location.assign(
                `/checkout/payment-return?cartId=${encodeURIComponent(cartId)}`
              );
            },
            onError: handleError,
          },
        });

        initializedRef.current = true;
        containerRef.current?.appendChild(button);
      } catch {
        if (!cancelled) onUnavailable();
      }
    }

    setup();
    return () => {
      cancelled = true;
      if (initializedRef.current) {
        window.MonoPay?.destroy();
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId]);

  // «Зберегти картку» перемкнули після ініціалізації → перегенерувати підписані
  // параметри (payload змінюється, стара трійка signature/requestId невалідна).
  useEffect(() => {
    if (saveCardRef.current === saveCard) return;
    saveCardRef.current = saveCard;
    if (!initializedRef.current || !window.MonoPay) return;
    getWidgetParams(cartId, saveCard).then((params) => {
      if (params && window.MonoPay) {
        window.MonoPay.update(params);
      }
    });
  }, [saveCard, cartId]);

  return (
    <div className="flex flex-col items-end gap-2">
      {errorMsg && (
        <p className="text-xs text-red-400 max-w-xs text-right">{errorMsg}</p>
      )}
      {status === "loading" && (
        <div className="h-12 min-w-[220px] px-8 rounded-xl bg-black border border-white/15 flex items-center justify-center gap-2 text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Завантаження monoPay…</span>
        </div>
      )}
      {/* Кнопку сюди вставляє сам віджет */}
      <div ref={containerRef} className={status === "loading" ? "hidden" : ""} />
    </div>
  );
}
