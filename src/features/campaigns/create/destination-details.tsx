"use client";

import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { cleanPhone, isPhone, type Draft } from "./blueprint";
import type { ClientOption, SectionProps } from "./create-campaign";

/** Extra details the chosen destination needs (shown in Start and Creative). */
export function DestinationDetails({
  draft,
  update,
  client,
  websiteError,
}: Pick<SectionProps, "draft" | "update"> & { client?: ClientOption; websiteError?: string }) {
  const dest = draft.ad.destination;
  const setAd = (patch: Partial<Draft["ad"]>) => update((d) => ({ ...d, ad: { ...d.ad, ...patch } }));
  // One website field feeds both the AI (setup.website) and the ad link (ad.url).
  const setWebsite = (v: string) => update((d) => ({ ...d, setup: { ...d.setup, website: v }, ad: { ...d.ad, url: d.ad.destination === "website" ? v : d.ad.url } }));
  const website = (label: string, hint: string, required = false) => (
    <Field id="website" label={required ? label : `${label} (optional)`} error={websiteError} hint={hint}>
      <Input id="website" type="url" placeholder="https://" value={draft.setup.website} aria-invalid={!!websiteError} onChange={(e) => setWebsite(e.target.value)} />
    </Field>
  );
  const phoneBad = (v: string) => (v.trim() && !isPhone(v) ? "Use the full number with country code, e.g. +91 98765 43210" : undefined);

  switch (dest) {
    case "website":
      return website("Website page", "The page people land on.", true);
    case "lead_form":
      return website("Website", "Shown as a button on the form's thank-you screen.");
    case "call":
      return (
        <div className="flex flex-col gap-4">
          <Field id="phone" label="Phone number to call" error={phoneBad(draft.ad.phone)} hint="With country code. Call ads show on phones only — make sure someone answers during business hours.">
            <div className="flex gap-2">
            <Input
              id="phone"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={draft.ad.phone}
              aria-invalid={!!phoneBad(draft.ad.phone)}
              onChange={(e) => setAd({ phone: e.target.value })}
              onBlur={(e) => isPhone(e.target.value) && setAd({ phone: cleanPhone(e.target.value) })}
            />
              <a
                href={isPhone(draft.ad.phone) ? `tel:${cleanPhone(draft.ad.phone)}` : undefined}
                aria-disabled={!isPhone(draft.ad.phone)}
                className={buttonClass({ variant: "secondary" }, !isPhone(draft.ad.phone) ? "pointer-events-none opacity-50" : undefined)}
              >
                Test call
              </a>
            </div>
          </Field>
          {website("Website", "Helps the AI write better copy.")}
        </div>
      );
    case "messenger":
      return (
        <div className="flex flex-col gap-4">
          <Callout>Tapping opens a Messenger chat with {client?.pageName ?? "the Facebook Page"}. Reply from the Page inbox or Meta Business Suite.</Callout>
          {website("Website", "Helps the AI write better copy.")}
        </div>
      );
    case "instagram_dm":
      return (
        <div className="flex flex-col gap-4">
          <Callout>
            Tapping opens a DM with {client?.instagramUsername ? `@${client.instagramUsername}` : "the Instagram account"}. Instagram message access must be allowed in its
            settings.
          </Callout>
          {website("Website", "Helps the AI write better copy.")}
        </div>
      );
    case "instagram_profile":
      return (
        <div className="flex flex-col gap-4">
          {client?.hasInstagram ? (
            <Callout>
              Tapping <strong>View Instagram profile</strong> opens {client.instagramUsername ? `@${client.instagramUsername}` : "the Instagram account"}. Meta optimises for profile visits — great
              for growing followers. Runs on Instagram only.
            </Callout>
          ) : (
            <Callout tone="error">Connect this client&apos;s Instagram account first (client page → assets).</Callout>
          )}
          <p className="text-[12px] text-ink-muted">Meta is still rolling this out — if the ad account doesn&apos;t have it yet, Meta says so when you click “Check with Meta” or launch.</p>
          {website("Website", "Helps the AI write better copy.")}
        </div>
      );
    case "none":
      return website("Website", "Optional “Learn more” link. Without one, the ad links to the Facebook Page.");
  }
}
