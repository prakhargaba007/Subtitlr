"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import axiosInstance from "@/utils/axios";

type PlanInterval = "monthly" | "annual" | "one_time";

// ─── Mirrors PlanCatalog.featureFlagsSchema ────────────────────────────────────
type FeatureFlags = {
  // Limits
  maxInputMinutes: number | null;
  maxFileSizeMB: number | null;
  maxConcurrentJobs: number | null;
  dailyLimitSeconds: number | null;
  monthlyLimitSeconds: number | null;
  overageAllowed: boolean;
  dailySafetyCapSeconds: number | null;
  dailyCostCapUSD: number | null;
  ratePerSecondUSD: number | null;
  // TTS / voice
  ttsProviders: string[];
  allowLibraryVoices: boolean;
  allowVoiceCloning: boolean;
  // Transcription
  allowSpeakerDiarization: boolean;
  allowSourceSeparation: boolean;
  sourceSeparationMethods: string[];
  // Post-processing
  lipSync: boolean;
  allowBackgroundMixControl: boolean;
  backgroundMix: { minDb: number; maxDb: number; defaultDb: number };
  // Export
  exportFormats: string[];
  watermark: boolean;
  retentionDays: number | null;
  // Languages
  supportedTargetLanguages: string[];
  // Queue
  queuePriority: string;
  // UI
  uiBadges: string[];
  supportLevel: string;
};

type PlanCatalogRow = {
  _id: string;
  key: string;
  displayName: string;
  priceDisplay?: string;       // final price string e.g. "$89/month"
  discountDisplay?: string;    // e.g. "18%"
  originalPrice?: number | null; // numeric original price e.g. 108
  interval: PlanInterval;
  dodoProductId: string;
  creditsPerPeriod: number;
  version: number;
  isActivePublic: boolean;
  sortOrder: number;
  featureFlags?: Partial<FeatureFlags>;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  maxInputMinutes: 60,
  maxFileSizeMB: 500,
  maxConcurrentJobs: 1,
  dailyLimitSeconds: null,
  monthlyLimitSeconds: null,
  overageAllowed: false,
  dailySafetyCapSeconds: null,
  dailyCostCapUSD: null,
  ratePerSecondUSD: null,
  ttsProviders: ["openai"],
  allowLibraryVoices: false,
  allowVoiceCloning: false,
  allowSpeakerDiarization: true,
  allowSourceSeparation: true,
  sourceSeparationMethods: ["replicate", "no_separation"],
  lipSync: false,
  allowBackgroundMixControl: false,
  backgroundMix: { minDb: -24, maxDb: -4, defaultDb: -12 },
  exportFormats: ["mp3", "mp4"],
  watermark: true,
  retentionDays: 7,
  supportedTargetLanguages: [],
  queuePriority: "normal",
  uiBadges: [],
  supportLevel: "email",
};

const INITIAL_FORM = {
  key: "",
  displayName: "",
  originalPrice: null as number | null,  // USD numeric price before discount
  discountPercent: 0,                    // percentage (0–100)
  finalPrice: null as number | null,     // what actually gets stored / shown to users
  interval: "monthly" as PlanInterval,
  dodoProductId: "",
  creditsPerPeriod: 50,
  version: 1,
  isActivePublic: true,
  sortOrder: 10,
  flags: { ...DEFAULT_FLAGS },
};

// ─── Option lists ──────────────────────────────────────────────────────────────
const TTS_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "inworld", label: "Inworld" },
  { value: "smallest", label: "Smallest.ai" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "sarvam", label: "Sarvam" },
  { value: "gemini", label: "Gemini" },
];
const SEP_METHODS = [
  { value: "replicate", label: "Replicate (Demucs)" },
  { value: "elevenlabs_fallback", label: "ElevenLabs fallback" },
  { value: "no_separation", label: "No separation" },
];
const EXPORT_FORMATS = [
  { value: "mp3", label: "MP3" },
  { value: "mp4", label: "MP4" },
  { value: "wav", label: "WAV" },
  { value: "srt", label: "SRT" },
  { value: "vtt", label: "VTT" },
];
const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ru", label: "Russian" },
  { value: "tr", label: "Turkish" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv", label: "Swedish" },
  { value: "id", label: "Indonesian" },
  { value: "ms", label: "Malay" },
  { value: "bn", label: "Bengali" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
  { value: "or", label: "Odia" },
];
const QUEUE_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "highest", label: "Highest" },
];
const SUPPORT_LEVELS = [
  { value: "email", label: "Email" },
  { value: "priority", label: "Priority" },
  { value: "priority_plus", label: "Priority Plus" },
];

function intervalLabel(i: PlanInterval) {
  if (i === "monthly") return "Monthly";
  if (i === "annual") return "Annual";
  return "One-time";
}

/**
 * Compute final price after a percentage discount.
 * priceDisplay e.g. "$29/month"  discountDisplay e.g. "20%" or "20% off"
 * Returns null when price can't be parsed (cell shows "—").
 */
function finalPrice(priceDisplay?: string, discountDisplay?: string): string | null {
  if (!priceDisplay) return null;

  const priceMatch = priceDisplay.match(/^([^\d]*?)([\d.]+)(.*)$/);
  if (!priceMatch) return priceDisplay;

  const symbol = priceMatch[1];
  const amount = parseFloat(priceMatch[2]);
  const suffix = priceMatch[3];

  if (!discountDisplay || discountDisplay.trim() === "" || discountDisplay.trim() === "-") {
    return priceDisplay; // no discount → show original
  }

  const pctMatch = discountDisplay.match(/([\d.]+)/);
  if (!pctMatch) return null;

  const pct = parseFloat(pctMatch[1]);
  const final = amount * (1 - pct / 100);
  return `${symbol}${final % 1 === 0 ? final : final.toFixed(2)}${suffix}`;
}

// ─── Nullable number input (empty string → null) ───────────────────────────────
function NullableNumber({
  label,
  description,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  description?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  step?: number;
}) {
  return (
    <NumberInput
      label={label}
      description={description ?? "Leave empty for no limit"}
      value={value ?? ""}
      onChange={(v) => onChange(v === "" || v === undefined ? null : Number(v))}
      min={min}
      step={step}
      allowDecimal={step !== undefined && step < 1}
      placeholder="No limit"
    />
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function PricingCatalogPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PlanCatalogRow[]>([]);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<PlanCatalogRow | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const canEdit = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("userRole") === "admin";
  }, []);

  // Helpers
  const setFlags = (patch: Partial<FeatureFlags>) =>
    setForm((f) => ({ ...f, flags: { ...f.flags, ...patch } }));

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/admin/plans");
      setRows(res.data?.plans || []);
    } catch (e: any) {
      notifications.show({
        color: "red",
        title: "Failed to load plans",
        message: e?.response?.data?.message || e?.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...INITIAL_FORM, flags: { ...DEFAULT_FLAGS } });
    setOpened(true);
  }

  function openEdit(r: PlanCatalogRow) {
    setEditing(r);

    // originalPrice is now a plain number field on the row — no parsing needed.
    const originalPrice: number | null = r.originalPrice ?? null;

    // Parse discountPercent back from stored discountDisplay string (e.g. "20%" → 20)
    let discountPercent = 0;
    if (r.discountDisplay) {
      const m = r.discountDisplay.match(/([\d.]+)/);
      if (m) discountPercent = parseFloat(m[1]);
    }

    // Parse finalPrice back from priceDisplay string (e.g. "$89/month" → 89)
    let finalPrice: number | null = null;
    if (r.priceDisplay) {
      const m = r.priceDisplay.match(/([\d.]+)/);
      if (m) finalPrice = parseFloat(m[1]);
    }

    setForm({
      key: r.key,
      displayName: r.displayName,
      originalPrice,
      discountPercent,
      finalPrice,
      interval: r.interval,
      dodoProductId: r.dodoProductId,
      creditsPerPeriod: r.creditsPerPeriod,
      version: r.version,
      isActivePublic: r.isActivePublic,
      sortOrder: r.sortOrder ?? 0,
      flags: { ...DEFAULT_FLAGS, ...(r.featureFlags as FeatureFlags) },
    });
    setOpened(true);
  }

  async function save() {
    if (!canEdit) return;
    const key = form.key.trim();
    const displayName = form.displayName.trim();
    const dodoProductId = form.dodoProductId.trim();

    if (!key || !displayName || !dodoProductId) {
      notifications.show({
        color: "red",
        title: "Missing fields",
        message: "key, displayName, and dodoProductId are required.",
      });
      return;
    }

    // priceDisplay = the explicit final price the user typed (or auto-computed)
    const intervalSuffix =
      form.interval === "monthly" ? "/month" : form.interval === "annual" ? "/year" : "";
    const priceDisplay =
      form.finalPrice != null
        ? `$${form.finalPrice}${intervalSuffix}`
        : "";
    const discountDisplay = form.discountPercent > 0 ? `${form.discountPercent}%` : "";

    const payload = {
      key,
      displayName,
      priceDisplay,
      discountDisplay,
      originalPrice: form.originalPrice ?? null,
      interval: form.interval,
      dodoProductId,
      creditsPerPeriod: Math.max(0, Math.floor(form.creditsPerPeriod || 0)),
      version: Math.max(1, Math.floor(form.version || 1)),
      isActivePublic: !!form.isActivePublic,
      sortOrder: Math.floor(form.sortOrder || 0),
      featureFlags: form.flags,
    };

    setLoading(true);
    try {
      if (!editing) {
        await axiosInstance.post("/api/admin/plans", payload);
        notifications.show({ color: "green", title: "Created", message: "Plan created." });
      } else {
        const { key: _k, version: _v, ...patchPayload } = payload;
        await axiosInstance.patch(`/api/admin/plans/${editing._id}`, patchPayload);
        notifications.show({ color: "green", title: "Saved", message: "Plan updated." });
      }
      setOpened(false);
      await loadPlans();
    } catch (e: any) {
      notifications.show({
        color: "red",
        title: "Save failed",
        message: e?.response?.data?.message || e?.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(r: PlanCatalogRow) {
    if (!canEdit) return;
    setLoading(true);
    try {
      await axiosInstance.patch(`/api/admin/plans/${r._id}`, {
        isActivePublic: !r.isActivePublic,
      });
      await loadPlans();
    } catch (e: any) {
      notifications.show({
        color: "red",
        title: "Update failed",
        message: e?.response?.data?.message || e?.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  const f = form.flags;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Pricing Catalog</Title>
          <Text c="dimmed" size="sm">
            Public plans shown to new buyers. Existing subscribers can be grandfathered by changing
            their subscription&apos;s credits per renewal separately.
          </Text>
        </div>
        <Group>
          <Button variant="default" onClick={loadPlans} loading={loading}>
            Refresh
          </Button>
          <Button onClick={openCreate} disabled={!canEdit}>
            New plan
          </Button>
        </Group>
      </Group>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Key</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Original price</Table.Th>
              <Table.Th>Discount</Table.Th>
              <Table.Th>Final price</Table.Th>
              <Table.Th>Interval</Table.Th>
              <Table.Th>Credits/period</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th>Dodo product</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r._id}>
                <Table.Td>
                  <Text fw={600}>{r.key}</Text>
                </Table.Td>
                <Table.Td>{r.displayName}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {r.originalPrice != null ? `$${r.originalPrice}` : "-"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.discountDisplay || "-"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600} c={r.priceDisplay ? "green" : "dimmed"}>
                    {r.priceDisplay || "-"}
                  </Text>
                </Table.Td>
                <Table.Td>{intervalLabel(r.interval)}</Table.Td>
                <Table.Td>{r.creditsPerPeriod}</Table.Td>
                <Table.Td>
                  <Badge variant="light">v{r.version}</Badge>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={!!r.isActivePublic}
                    onChange={() => toggleActive(r)}
                    disabled={!canEdit || loading}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} title={r.dodoProductId}>
                    {r.dodoProductId}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => openEdit(r)}
                      disabled={!canEdit}
                    >
                      Edit
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {rows.length === 0 && (
          <Text c="dimmed" size="sm" mt="md">
            No plans found. Create one or seed via environment variable in the backend.
          </Text>
        )}
      </Card>

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? "Edit plan" : "Create plan"}
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Stack>
          {/* ── Core plan fields ─────────────────────────────── */}
          <Group grow>
            <TextInput
              label="Key"
              placeholder="premium_monthly"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              disabled={!!editing}
              required
            />
            <NumberInput
              label="Version"
              value={form.version}
              onChange={(v) => setForm((f) => ({ ...f, version: Number(v) || 1 }))}
              min={1}
              disabled={!!editing}
              required
            />
          </Group>

          <TextInput
            label="Display name"
            placeholder="Premium"
            value={form.displayName}
            onChange={(e) => setForm((fv) => ({ ...fv, displayName: e.target.value }))}
            required
          />

          <Group grow align="flex-end">
            <NumberInput
              label="Original price (USD)"
              placeholder="108"
              value={form.originalPrice ?? ""}
              onChange={(v) => {
                const orig = v === "" || v === undefined ? null : Number(v);
                setForm((fv) => ({ ...fv, originalPrice: orig }));
              }}
              prefix="$"
              min={0}
              step={1}
              allowDecimal
              description="Base price before discount (reference only)."
            />
            <NumberInput
              label="Discount (%)"
              placeholder="0"
              value={form.discountPercent}
              onChange={(v) => {
                const pct = Number(v) || 0;
                setForm((fv) => ({ ...fv, discountPercent: pct }));
              }}
              min={0}
              max={100}
              step={1}
              suffix="%"
              description="Percentage off the original price."
            />
            <NumberInput
              label="Final price (USD)"
              placeholder="89"
              value={form.finalPrice ?? ""}
              onChange={(v) =>
                setForm((fv) => ({
                  ...fv,
                  finalPrice: v === "" || v === undefined ? null : Number(v),
                }))
              }
              prefix="$"
              min={0}
              step={1}
              allowDecimal
              description="Final price after discount. Set manually."
              styles={{ input: { fontWeight: 700, color: "var(--mantine-color-green-7)" } }}
            />
          </Group>

          <Group grow>
            <Select
              label="Interval"
              value={form.interval}
              onChange={(v) =>
                setForm((fv) => ({ ...fv, interval: (v || "monthly") as PlanInterval }))
              }
              data={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
                { value: "one_time", label: "One-time" },
              ]}
              required
            />
            <NumberInput
              label="Credits per month"
              value={form.creditsPerPeriod}
              onChange={(v) => setForm((fv) => ({ ...fv, creditsPerPeriod: Number(v) || 0 }))}
              min={0}
              required
            />
          </Group>

          <TextInput
            label="Dodo product id"
            placeholder="prod_subscription_monthly"
            value={form.dodoProductId}
            onChange={(e) => setForm((fv) => ({ ...fv, dodoProductId: e.target.value }))}
            required
          />

          <Group grow>
            <NumberInput
              label="Sort order"
              value={form.sortOrder}
              onChange={(v) => setForm((fv) => ({ ...fv, sortOrder: Number(v) || 0 }))}
            />
            <Switch
              mt={28}
              label="Active (public)"
              checked={!!form.isActivePublic}
              onChange={(e: any) => {
                const checked = typeof e === "boolean" ? e : !!e?.currentTarget?.checked;
                setForm((fv) => ({ ...fv, isActivePublic: checked }));
              }}
            />
          </Group>

          <Divider label="Feature flags" labelPosition="left" mt="sm" />

          {/* ── Section: Limits ────────────────────────────────── */}
          <Text fw={600} size="sm" c="dimmed">
            Limits
          </Text>
          <SimpleGrid cols={2}>
            <NullableNumber
              label="Max input minutes"
              description="Max duration per upload in minutes. Empty = no limit."
              value={f.maxInputMinutes}
              onChange={(v) => setFlags({ maxInputMinutes: v })}
              min={0}
            />
            <NullableNumber
              label="Max file size (MB)"
              description="Max upload size. Empty = no limit."
              value={f.maxFileSizeMB}
              onChange={(v) => setFlags({ maxFileSizeMB: v })}
              min={0}
            />
            <NullableNumber
              label="Max concurrent jobs"
              description="Per user. Empty = no limit."
              value={f.maxConcurrentJobs}
              onChange={(v) => setFlags({ maxConcurrentJobs: v })}
              min={0}
            />
            <NullableNumber
              label="Daily limit (seconds)"
              description="Rolling calendar-day quota. Empty = no limit."
              value={f.dailyLimitSeconds}
              onChange={(v) => setFlags({ dailyLimitSeconds: v })}
              min={0}
            />
            <NullableNumber
              label="Monthly limit (seconds)"
              description="Rolling billing-cycle quota. Empty = no limit."
              value={f.monthlyLimitSeconds}
              onChange={(v) => setFlags({ monthlyLimitSeconds: v })}
              min={0}
            />
            <NullableNumber
              label="Daily safety cap (seconds)"
              description="Absolute daily ceiling — cannot be overridden. Empty = no cap."
              value={f.dailySafetyCapSeconds}
              onChange={(v) => setFlags({ dailySafetyCapSeconds: v })}
              min={0}
            />
            <NullableNumber
              label="Daily cost cap (USD)"
              description="Block when daily spend exceeds this. Empty = no cap."
              value={f.dailyCostCapUSD}
              onChange={(v) => setFlags({ dailyCostCapUSD: v })}
              min={0}
              step={0.01}
            />
            <NullableNumber
              label="Rate per second (USD)"
              description="Cost per second of dubbing. Required for cost-cap to work."
              value={f.ratePerSecondUSD}
              onChange={(v) => setFlags({ ratePerSecondUSD: v })}
              min={0}
              step={0.000001}
            />
          </SimpleGrid>
          <Checkbox
            label="Allow overage (continue past monthly limit)"
            checked={f.overageAllowed}
            onChange={(e) => setFlags({ overageAllowed: e.currentTarget.checked })}
          />

          {/* ── Section: TTS & Voice ───────────────────────────── */}
          <Divider mt="xs" />
          <Text fw={600} size="sm" c="dimmed">
            TTS & Voice
          </Text>
          <MultiSelect
            label="Allowed TTS providers"
            data={TTS_PROVIDERS}
            value={f.ttsProviders}
            onChange={(v) => setFlags({ ttsProviders: v })}
            description="Which TTS engines users on this plan can select."
          />
          <Group>
            <Checkbox
              label="Allow library voices (ElevenLabs shared)"
              checked={f.allowLibraryVoices}
              onChange={(e) => setFlags({ allowLibraryVoices: e.currentTarget.checked })}
            />
            <Checkbox
              label="Allow voice cloning"
              checked={f.allowVoiceCloning}
              onChange={(e) => setFlags({ allowVoiceCloning: e.currentTarget.checked })}
            />
          </Group>

          {/* ── Section: Transcription / Pipeline ─────────────── */}
          <Divider mt="xs" />
          <Text fw={600} size="sm" c="dimmed">
            Transcription & Pipeline
          </Text>
          <Group>
            <Checkbox
              label="Allow speaker diarization"
              checked={f.allowSpeakerDiarization}
              onChange={(e) => setFlags({ allowSpeakerDiarization: e.currentTarget.checked })}
            />
            <Checkbox
              label="Allow source separation"
              checked={f.allowSourceSeparation}
              onChange={(e) => setFlags({ allowSourceSeparation: e.currentTarget.checked })}
            />
          </Group>
          <MultiSelect
            label="Source separation methods"
            data={SEP_METHODS}
            value={f.sourceSeparationMethods}
            onChange={(v) => setFlags({ sourceSeparationMethods: v })}
          />

          {/* ── Section: Post-processing ───────────────────────── */}
          <Divider mt="xs" />
          <Text fw={600} size="sm" c="dimmed">
            Post-processing
          </Text>
          <Group>
            <Checkbox
              label="Lip sync (Wav2Lip)"
              checked={f.lipSync}
              onChange={(e) => setFlags({ lipSync: e.currentTarget.checked })}
            />
            <Checkbox
              label="Background mix volume control"
              checked={f.allowBackgroundMixControl}
              onChange={(e) => setFlags({ allowBackgroundMixControl: e.currentTarget.checked })}
            />
          </Group>
          {f.allowBackgroundMixControl && (
            <SimpleGrid cols={3}>
              <NumberInput
                label="Background min dB"
                value={f.backgroundMix.minDb}
                onChange={(v) =>
                  setFlags({ backgroundMix: { ...f.backgroundMix, minDb: Number(v) } })
                }
                step={1}
                allowDecimal={false}
              />
              <NumberInput
                label="Background max dB"
                value={f.backgroundMix.maxDb}
                onChange={(v) =>
                  setFlags({ backgroundMix: { ...f.backgroundMix, maxDb: Number(v) } })
                }
                step={1}
                allowDecimal={false}
              />
              <NumberInput
                label="Background default dB"
                value={f.backgroundMix.defaultDb}
                onChange={(v) =>
                  setFlags({ backgroundMix: { ...f.backgroundMix, defaultDb: Number(v) } })
                }
                step={1}
                allowDecimal={false}
              />
            </SimpleGrid>
          )}

          {/* ── Section: Export & Output ───────────────────────── */}
          <Divider mt="xs" />
          <Text fw={600} size="sm" c="dimmed">
            Export & Output
          </Text>
          <MultiSelect
            label="Allowed export formats"
            data={EXPORT_FORMATS}
            value={f.exportFormats}
            onChange={(v) => setFlags({ exportFormats: v })}
          />
          <SimpleGrid cols={2}>
            <Checkbox
              label="Add watermark to output"
              checked={f.watermark}
              onChange={(e) => setFlags({ watermark: e.currentTarget.checked })}
            />
            <NullableNumber
              label="Retention (days)"
              description="Days output files are kept. Empty = forever."
              value={f.retentionDays}
              onChange={(v) => setFlags({ retentionDays: v })}
              min={0}
            />
          </SimpleGrid>

          {/* ── Section: Languages ────────────────────────────── */}
          <Divider mt="xs" />
          <Text fw={600} size="sm" c="dimmed">
            Supported Target Languages
          </Text>
          <MultiSelect
            label="Languages (empty = all allowed)"
            data={LANG_OPTIONS}
            value={f.supportedTargetLanguages}
            onChange={(v) => setFlags({ supportedTargetLanguages: v })}
            searchable
            clearable
            description="Leave empty to allow all languages."
          />

          {/* ── Section: Queue & Support ───────────────────────── */}
          <Divider mt="xs" />
          <Text fw={600} size="sm" c="dimmed">
            Queue & Support
          </Text>
          <Group grow>
            <Select
              label="Queue priority"
              data={QUEUE_PRIORITIES}
              value={f.queuePriority}
              onChange={(v) => setFlags({ queuePriority: v || "normal" })}
            />
            <Select
              label="Support level"
              data={SUPPORT_LEVELS}
              value={f.supportLevel}
              onChange={(v) => setFlags({ supportLevel: v || "email" })}
            />
          </Group>

          {/* ── Section: UI Badges ─────────────────────────────── */}
          <MultiSelect
            label="UI badges"
            data={[
              { value: "best_value", label: "Best value" },
              { value: "popular", label: "Popular" },
              { value: "new", label: "New" },
            ]}
            value={f.uiBadges}
            onChange={(v) => setFlags({ uiBadges: v })}
            description="Decorative badges shown on the plan card."
          />

          {/* ── Actions ────────────────────────────────────────── */}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setOpened(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={loading} disabled={!canEdit}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
