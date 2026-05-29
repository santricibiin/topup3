"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  RotateCcw,
  User as UserIcon,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  initial: {
    username: string;
    email: string;
    fullName: string;
    phone: string;
    avatarUrl: string;
  };
}

export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const dataDirty = fullName !== initial.fullName || phone !== initial.phone;

  function reset() {
    setFullName(initial.fullName);
    setPhone(initial.phone);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataDirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal simpan");
      toast.success("Profil tersimpan");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran maksimal 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal upload");
      setAvatarUrl(json.data.avatarUrl);
      toast.success("Foto profil diperbarui");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (!avatarUrl) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal hapus");
      setAvatarUrl("");
      toast.success("Foto profil dihapus");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  const initials = (initial.fullName || initial.username || "??")
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={cn(
          "flex items-center gap-4 rounded-xl border-2 border-dashed bg-card p-4 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40",
        )}
      >
        <div className="relative shrink-0">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-violet-600 text-2xl font-semibold text-white shadow-md ring-2 ring-card">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-20 w-20 object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition-transform hover:scale-110 disabled:opacity-60"
            aria-label="Upload foto"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold tracking-tight">
            {initial.fullName || initial.username}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {initial.email}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload Foto
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeAvatar}
                disabled={removing}
                className="text-destructive hover:bg-destructive/10"
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Hapus
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            JPG, PNG, WEBP, atau GIF · Maks 2 MB · Drag-drop juga didukung
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {/* Username (read-only) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          Username
        </Label>
        <Input value={initial.username} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Username tidak dapat diubah.
        </p>
      </div>

      {/* Email (read-only) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          Email
        </Label>
        <Input value={initial.email} disabled readOnly />
      </div>

      {/* Full name */}
      <div className="space-y-2">
        <Label htmlFor="fullName">Nama Lengkap</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Mis. Budi Santoso"
          maxLength={120}
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          Nomor HP
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08xxxxxxxxxx"
          maxLength={20}
        />
        <p className="text-xs text-muted-foreground">
          Format: 08xx atau +62xx (tanpa spasi).
        </p>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="text-xs text-muted-foreground">
          {dataDirty ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Ada perubahan belum disimpan
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Tersinkron
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {dataDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <Button type="submit" disabled={saving || !dataDirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal");
      toast.success("Password berhasil diganti");
      setCurrent("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cur-pass" className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          Password Saat Ini
        </Label>
        <div className="relative">
          <Input
            id="cur-pass"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={showCurrent ? "Sembunyikan" : "Tampilkan"}
          >
            {showCurrent ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-pass">Password Baru</Label>
        <div className="relative">
          <Input
            id="new-pass"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={showNew ? "Sembunyikan" : "Tampilkan"}
          >
            {showNew ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-pass">Konfirmasi Password Baru</Label>
        <Input
          id="confirm-pass"
          type={showNew ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={saving || !currentPassword || !newPassword || !confirm}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          Ganti Password
        </Button>
      </div>
    </form>
  );
}
