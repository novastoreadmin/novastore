"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin, Search } from "lucide-react";
import {
  getNpWarehouses,
  searchNpCities,
  type NpCity,
  type NpWarehouse,
} from "@/lib/novaposhta";

/**
 * Nova Poshta delivery pickers for the checkout Shipping step.
 * - kind="warehouse": city autocomplete + warehouse (відділення) selector
 * - kind="courier":   city autocomplete + street / house / flat inputs
 *
 * Styling intentionally mirrors the checkout's InputField look.
 */

const inputClass =
  "w-full h-12 px-4 rounded-xl bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all";

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-text-secondary mb-2">
      {children}
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
  );
}

export function NovaPoshtaPicker({
  kind,
  city,
  onCityChange,
  warehouse,
  onWarehouseChange,
  street,
  onStreetChange,
  house,
  onHouseChange,
  flat,
  onFlatChange,
  defaultCityQuery,
}: {
  kind: "warehouse" | "courier";
  city: NpCity | null;
  onCityChange: (city: NpCity | null) => void;
  warehouse: NpWarehouse | null;
  onWarehouseChange: (warehouse: NpWarehouse | null) => void;
  street: string;
  onStreetChange: (v: string) => void;
  house: string;
  onHouseChange: (v: string) => void;
  flat: string;
  onFlatChange: (v: string) => void;
  defaultCityQuery?: string;
}) {
  const [cityQuery, setCityQuery] = useState(city?.name ?? defaultCityQuery ?? "");
  const [cityResults, setCityResults] = useState<NpCity[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);

  const [warehouses, setWarehouses] = useState<NpWarehouse[]>([]);
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [warehouseLoading, setWarehouseLoading] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  // City autocomplete (debounced). Skips the lookup when the query already
  // matches the picked city, so reopening the field doesn't refetch.
  useEffect(() => {
    if (!cityQuery.trim() || cityQuery === city?.name) {
      setCityResults([]);
      return;
    }
    setCityLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchNpCities(cityQuery);
        setCityResults(results);
        setCityOpen(true);
      } catch {
        setCityResults([]);
      } finally {
        setCityLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      setCityLoading(false);
    };
  }, [cityQuery, city?.name]);

  // Load the warehouse list once a city is picked (branch delivery only).
  useEffect(() => {
    if (kind !== "warehouse" || !city) {
      setWarehouses([]);
      return;
    }
    let active = true;
    setWarehouseLoading(true);
    getNpWarehouses(city.ref)
      .then((list) => active && setWarehouses(list))
      .catch(() => active && setWarehouses([]))
      .finally(() => active && setWarehouseLoading(false));
    return () => {
      active = false;
    };
  }, [kind, city]);

  // Close dropdowns on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setCityOpen(false);
        setWarehouseOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filteredWarehouses = warehouseQuery.trim()
    ? warehouses.filter((w) =>
        w.description.toLowerCase().includes(warehouseQuery.toLowerCase())
      )
    : warehouses;

  return (
    <div ref={rootRef} className="mt-6 p-5 rounded-xl border border-border bg-bg-card/50 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="w-4 h-4 text-text-secondary" />
        {kind === "warehouse" ? "Пункт видачі Нової Пошти" : "Адреса для кур'єра Нової Пошти"}
      </div>

      {/* City */}
      <div className="relative">
        <FieldLabel required>Місто</FieldLabel>
        <div className="relative">
          <input
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              onCityChange(null);
              onWarehouseChange(null);
            }}
            onFocus={() => cityResults.length > 0 && setCityOpen(true)}
            placeholder="Почніть вводити місто (українською)…"
            className={inputClass}
          />
          {cityLoading ? (
            <Loader2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />
          ) : (
            <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-muted" />
          )}
        </div>
        {cityOpen && cityResults.length > 0 && (
          <ul className="absolute z-20 mt-2 w-full rounded-xl bg-bg-card border border-border max-h-56 overflow-auto shadow-xl">
            {cityResults.map((c) => (
              <li key={c.ref}>
                <button
                  type="button"
                  onClick={() => {
                    onCityChange(c);
                    setCityQuery(c.name);
                    setCityOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                >
                  <span className="text-text-primary">{c.name}</span>
                  {c.area && (
                    <span className="text-xs text-text-muted ml-2">{c.area} обл.</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Warehouse (branch delivery) */}
      {kind === "warehouse" && (
        <div className="relative">
          <FieldLabel required>Відділення / поштомат</FieldLabel>
          <button
            type="button"
            disabled={!city}
            onClick={() => setWarehouseOpen((v) => !v)}
            className={`${inputClass} flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className={warehouse ? "" : "text-text-muted"}>
              {warehouse
                ? warehouse.description
                : city
                  ? warehouseLoading
                    ? "Завантаження відділень…"
                    : "Оберіть відділення"
                  : "Спершу оберіть місто"}
            </span>
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0 ml-2" />
          </button>
          {warehouseOpen && city && (
            <div className="absolute z-20 mt-2 w-full rounded-xl bg-bg-card border border-border shadow-xl">
              <div className="p-2 border-b border-border">
                <input
                  value={warehouseQuery}
                  onChange={(e) => setWarehouseQuery(e.target.value)}
                  placeholder="Пошук за номером чи адресою…"
                  className="w-full h-10 px-3 rounded-lg bg-bg border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20"
                />
              </div>
              <ul className="max-h-56 overflow-auto">
                {filteredWarehouses.length === 0 && (
                  <li className="px-4 py-3 text-sm text-text-muted">
                    {warehouseLoading ? "Завантаження…" : "Нічого не знайдено"}
                  </li>
                )}
                {filteredWarehouses.slice(0, 100).map((w) => (
                  <li key={w.ref}>
                    <button
                      type="button"
                      onClick={() => {
                        onWarehouseChange(w);
                        setWarehouseOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                    >
                      {w.description}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Street address (courier delivery) */}
      {kind === "courier" && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,100px,100px] gap-4">
          <div>
            <FieldLabel required>Вулиця</FieldLabel>
            <input
              value={street}
              onChange={(e) => onStreetChange(e.target.value)}
              placeholder="вул. Хрещатик"
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel required>Будинок</FieldLabel>
            <input
              value={house}
              onChange={(e) => onHouseChange(e.target.value)}
              placeholder="1"
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel>Квартира</FieldLabel>
            <input
              value={flat}
              onChange={(e) => onFlatChange(e.target.value)}
              placeholder="12"
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}
