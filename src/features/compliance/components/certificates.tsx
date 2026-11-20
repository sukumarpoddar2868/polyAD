"use client";

import { useActionState, useState } from "react";
import { FileCheck2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { addCertificateAction, createCertUploadAction, deleteCertificateAction, type FormState } from "../actions";
import { CERT_FILE } from "../rules";

export type CertView = { id: number; certNo: string; committee: string; issuedOn: string; title: string; fileUrl: string | null; used: number };

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** MCMC certificates for one candidate: list + add (with scan upload). */
export function Certificates({ clientId, certs }: { clientId: number; certs: CertView[] }) {
  return (
    <div className="flex flex-col gap-5">
      {certs.length === 0 ? (
        <p className="text-[14px] text-ink-muted">No certificates yet. Every ad needs one before it can launch.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {certs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-lavender-soft px-4 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{c.title}</p>
                <p className="text-[13px] text-ink-muted">
                  No. {c.certNo} · {c.committee} · {fmtDay(c.issuedOn)}
                  {c.used > 0 && ` · used by ${c.used} campaign${c.used === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.fileUrl && (
                  <a href={c.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[14px] font-bold underline">
                    <FileCheck2 className="size-4" aria-hidden /> Scan
                  </a>
                )}
                <form action={deleteCertificateAction.bind(null, clientId, c.id)}>
                  <Button variant="danger" size="sm" type="submit" aria-label={`Remove certificate ${c.certNo}`}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddCertificate clientId={clientId} />
    </div>
  );
}

function AddCertificate({ clientId }: { clientId: number }) {
  const [filePath, setFilePath] = useState("");
  const [upload, setUpload] = useState<{ busy: boolean; error?: string; name?: string }>({ busy: false });
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await addCertificateAction(clientId, prev, form);
    if (r.ok) {
      setFilePath("");
      setUpload({ busy: false });
    }
    return r;
  }, {});

  async function pick(file: File | undefined) {
    if (!file) return;
    setUpload({ busy: true, name: file.name });
    const start = await createCertUploadAction({ clientId, contentType: file.type, size: file.size });
    if (!start.ok) return setUpload({ busy: false, error: start.error });
    const res = await fetch(start.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file }).catch(() => null);
    if (!res?.ok) return setUpload({ busy: false, error: "Upload failed. Please try again." });
    setFilePath(start.path);
    setUpload({ busy: false, name: file.name });
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-[10px] bg-chartreuse-soft p-5">
      <p className="text-[15px] font-bold">Add a certificate</p>
      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && <Callout tone="success">Certificate added.</Callout>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="certTitle" label="Ad / creative it certifies">
          <Input id="certTitle" name="title" required maxLength={200} placeholder="e.g. Roads video, 30 sec" />
        </Field>
        <Field id="certNo" label="Certificate number">
          <Input id="certNo" name="certNo" required maxLength={80} placeholder="e.g. MCMC/LKO/2027/112" />
        </Field>
        <Field id="committee" label="Issued by">
          <Input id="committee" name="committee" required maxLength={120} placeholder="e.g. District MCMC, Lucknow" />
        </Field>
        <Field id="issuedOn" label="Issue date">
          <Input id="issuedOn" name="issuedOn" type="date" required />
        </Field>
      </div>
      <Field id="certFile" label="Scan or photo (optional)" hint={upload.error ? undefined : upload.busy ? `Uploading ${upload.name}…` : filePath ? `Uploaded: ${upload.name}` : CERT_FILE.label} error={upload.error}>
        <Input id="certFile" type="file" accept={Object.keys(CERT_FILE.types).join(",")} onChange={(e) => pick(e.target.files?.[0])} className="h-auto py-2" />
      </Field>
      <input type="hidden" name="filePath" value={filePath} />
      <Button type="submit" disabled={pending || upload.busy} className="self-start">
        {pending ? "Saving…" : "Add certificate"}
      </Button>
    </form>
  );
}
