"use client";

import { useEffect, useState } from "react";

interface Profile {
  legalName: string;
  businessName: string;
  vatId: string;
  taxNumber: string;
  kleinunternehmer: boolean;
  vatRegistered: boolean;
  invoiceLanguage: "en" | "de";
  defaultPaymentTermsDays: number;
  preferredCurrency: string;
}

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState("local");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => { setProfile(d.profile); setMode(d.storageMode); });
  }, []);

  async function save(patch: Partial<Profile>) {
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (res.ok) { setProfile(d.profile); setSaved(true); }
  }

  if (!profile) return <p className="text-sm text-tf-gray">Loading…</p>;
  const label = "text-xs font-semibold uppercase tracking-wide text-tf-gray";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Account</h1>
      <p className="text-sm text-tf-gray">Your seeded Taxfix profile (synthetic). Edits persist for this session.</p>

      <div className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
        <p className="font-semibold">{profile.legalName}</p>
        <p className="text-sm text-tf-gray">{profile.businessName}</p>
        <p className="mt-1 text-xs text-tf-gray">Tax no. {profile.taxNumber} · VAT ID {profile.vatId}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
        <label className="flex items-center justify-between">
          <span className={label}>Kleinunternehmer (§19)</span>
          <input type="checkbox" checked={profile.kleinunternehmer}
            onChange={(e) => save({ kleinunternehmer: e.target.checked, vatRegistered: !e.target.checked })} />
        </label>
        <label className="flex items-center justify-between">
          <span className={label}>Invoice language</span>
          <select className="rounded-tf border border-tf-divider px-2 py-1 text-sm" value={profile.invoiceLanguage}
            onChange={(e) => save({ invoiceLanguage: e.target.value as "en" | "de" })}>
            <option value="en">English</option>
            <option value="de">German</option>
          </select>
        </label>
        <label className="flex items-center justify-between">
          <span className={label}>Payment terms (days)</span>
          <input type="number" className="w-20 rounded-tf border border-tf-divider px-2 py-1 text-sm" value={profile.defaultPaymentTermsDays}
            onChange={(e) => save({ defaultPaymentTermsDays: Number(e.target.value) })} />
        </label>
      </div>

      {saved ? <p className="text-xs text-tf-green-dark">Saved.</p> : null}
      <p className="text-xs text-tf-gray">Persistence: {mode === "local" ? "Local demo mode" : "Supabase"}</p>
    </div>
  );
}
