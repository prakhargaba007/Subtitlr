"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import axiosInstance from "@/utils/axios";

type PlanInterval = "monthly" | "annual" | "one_time";

type PlanCatalogRow = {
  _id: string;
  key: string;
  displayName: string;
  priceDisplay?: string;
  discountDisplay?: string;
  interval: PlanInterval;
  dodoProductId: string;
  creditsPerPeriod: number;
  version: number;
  isActivePublic: boolean;
  sortOrder: number;
  featureFlags?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

function intervalLabel(i: PlanInterval) {
  if (i === "monthly") return "Monthly";
  if (i === "annual") return "Annual";
  return "One-time";
}

export default function PricingCatalogPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PlanCatalogRow[]>([]);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<PlanCatalogRow | null>(null);

  const [form, setForm] = useState({
    key: "",
    displayName: "",
    priceDisplay: "",
    discountDisplay: "",
    interval: "monthly" as PlanInterval,
    dodoProductId: "",
    creditsPerPeriod: 50,
    version: 1,
    isActivePublic: true,
    sortOrder: 10,
    featureFlagsJson: "{}",
  });

  const canEdit = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("userRole") === "admin";
  }, []);

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
    setForm({
      key: "",
      displayName: "",
      priceDisplay: "",
      discountDisplay: "",
      interval: "monthly",
      dodoProductId: "",
      creditsPerPeriod: 50,
      version: 1,
      isActivePublic: true,
      sortOrder: 10,
      featureFlagsJson: "{}",
    });
    setOpened(true);
  }

  function openEdit(r: PlanCatalogRow) {
    setEditing(r);
    setForm({
      key: r.key,
      displayName: r.displayName,
      priceDisplay: String(r.priceDisplay || ""),
      discountDisplay: String(r.discountDisplay || ""),
      interval: r.interval,
      dodoProductId: r.dodoProductId,
      creditsPerPeriod: r.creditsPerPeriod,
      version: r.version,
      isActivePublic: r.isActivePublic,
      sortOrder: r.sortOrder ?? 0,
      featureFlagsJson: JSON.stringify(r.featureFlags || {}, null, 2),
    });
    setOpened(true);
  }

  async function save() {
    if (!canEdit) return;
    const key = form.key.trim();
    const displayName = form.displayName.trim();
    const priceDisplay = form.priceDisplay.trim();
    const discountDisplay = form.discountDisplay.trim();
    const dodoProductId = form.dodoProductId.trim();

    if (!key || !displayName || !dodoProductId) {
      notifications.show({
        color: "red",
        title: "Missing fields",
        message: "key, displayName, and dodoProductId are required.",
      });
      return;
    }

    let featureFlags: any = {};
    try {
      featureFlags = form.featureFlagsJson.trim()
        ? JSON.parse(form.featureFlagsJson)
        : {};
    } catch (e: any) {
      notifications.show({
        color: "red",
        title: "Invalid featureFlags JSON",
        message: e?.message || "JSON parse error",
      });
      return;
    }

    setLoading(true);
    try {
      if (!editing) {
        await axiosInstance.post("/api/admin/plans", {
          key,
          displayName,
          priceDisplay,
          discountDisplay,
          interval: form.interval,
          dodoProductId,
          creditsPerPeriod: Math.max(0, Math.floor(form.creditsPerPeriod || 0)),
          version: Math.max(1, Math.floor(form.version || 1)),
          isActivePublic: !!form.isActivePublic,
          sortOrder: Math.floor(form.sortOrder || 0),
          featureFlags,
        });
        notifications.show({ color: "green", title: "Created", message: "Plan created." });
      } else {
        await axiosInstance.patch(`/api/admin/plans/${editing._id}`, {
          displayName,
          priceDisplay,
          discountDisplay,
          interval: form.interval,
          dodoProductId,
          creditsPerPeriod: Math.max(0, Math.floor(form.creditsPerPeriod || 0)),
          isActivePublic: !!form.isActivePublic,
          sortOrder: Math.floor(form.sortOrder || 0),
          featureFlags,
        });
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
              <Table.Th>Price</Table.Th>
              <Table.Th>Discount</Table.Th>
              <Table.Th>Interval</Table.Th>
              <Table.Th>Credits/period</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th>Dodo product</Table.Th>
              <Table.Th></Table.Th>
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
                  <Text size="sm">{r.priceDisplay || "-"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.discountDisplay || "-"}</Text>
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

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? "Edit plan" : "Create plan"}
        size="lg"
      >
        <Stack>
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
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            required
          />

          <Group grow>
            <TextInput
              label="Price (display)"
              placeholder="$10/month"
              value={form.priceDisplay}
              onChange={(e) => setForm((f) => ({ ...f, priceDisplay: e.target.value }))}
              description="Display only. Actual charge is configured in Dodo."
            />
            <TextInput
              label="Discount (display)"
              placeholder="20% off"
              value={form.discountDisplay}
              onChange={(e) => setForm((f) => ({ ...f, discountDisplay: e.target.value }))}
              description="Display only."
            />
          </Group>

          <Group grow>
            <Select
              label="Interval"
              value={form.interval}
              onChange={(v) => setForm((f) => ({ ...f, interval: (v || "monthly") as PlanInterval }))}
              data={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
                { value: "one_time", label: "One-time" },
              ]}
              required
            />
            <NumberInput
              label="Credits per period"
              value={form.creditsPerPeriod}
              onChange={(v) => setForm((f) => ({ ...f, creditsPerPeriod: Number(v) || 0 }))}
              min={0}
              required
            />
          </Group>

          <TextInput
            label="Dodo product id"
            placeholder="prod_subscription_monthly"
            value={form.dodoProductId}
            onChange={(e) => setForm((f) => ({ ...f, dodoProductId: e.target.value }))}
            required
          />

          <Group grow>
            <NumberInput
              label="Sort order"
              value={form.sortOrder}
              onChange={(v) => setForm((f) => ({ ...f, sortOrder: Number(v) || 0 }))}
            />
            <Switch
              mt={28}
              label="Active (public)"
              checked={!!form.isActivePublic}
              onChange={(e: any) => {
                const checked =
                  typeof e === "boolean" ? e : !!e?.currentTarget?.checked;
                setForm((f) => ({ ...f, isActivePublic: checked }));
              }}
            />
          </Group>

          <Textarea
            label="Feature flags (JSON)"
            autosize
            minRows={6}
            value={form.featureFlagsJson}
            onChange={(e) => setForm((f) => ({ ...f, featureFlagsJson: e.target.value }))}
            description="Optional. Keep it a JSON object."
          />

          <Group justify="flex-end">
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

