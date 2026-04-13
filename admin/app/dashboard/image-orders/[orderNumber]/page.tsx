"use client";

import React, { useEffect, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { useParams, useRouter } from "next/navigation";
import axiosInstance from "@/utils/axios";
import {
  Loader,
  Alert,
  Badge,
  Card,
  Button,
  Group,
  Text,
  Title,
  Grid,
  Textarea,
  Select,
  Stack,
  Modal,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Package,
  Clock,
  ImageIcon,
  Mail,
  User,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit,
  X,
  Save,
  Download,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import JSZip from "jszip";

interface OrderImage {
  _id: string;
  filePath: string;
  fileName: string;
  mimeType?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  images?: OrderImage[];
  status: string;
  payment: {
    status: string;
    amount: number;
    method?: string;
    transactionId?: string;
    paidAt?: string;
  };
  pricing: {
    basePrice: number;
    totalImages: number;
    pricePerImage: number;
    totalAmount: number;
    discount: number;
    finalAmount: number;
  };
  createdAt: string;
  updatedAt: string;
  delivery?: {
    expectedDelivery?: string;
    actualDelivery?: string;
  };
  notes?: {
    customerNotes?: string;
    adminNotes?: string;
  };
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [statusModalOpened, { open: openStatusModal, close: closeStatusModal }] =
    useDisclosure(false);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderNumber) {
        setError("Order number is missing");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/api/image-orders/by-order-number?orderNumber=${orderNumber}`
        );

        if (response.data.success && response.data.order) {
          const orderData = response.data.order;
          setOrder(orderData);
          setNewStatus(orderData.status);
          setAdminNotes(orderData.notes?.adminNotes || "");
        } else {
          setError("Order not found");
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        const errorMessage =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Failed to load order details";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber]);

  const handleUpdateStatus = () => {
    openStatusModal();
  };

  const handleConfirmOrder = async () => {
    if (!order) return;

    // Simple confirmation
    if (!confirm(`Are you sure you want to mark order ${order.orderNumber} as completed?`)) {
      return;
    }

    try {
      setUpdating(true);
      const response = await axiosInstance.put(
        `/api/image-orders/admin/${order._id}/status`,
        {
          status: "completed",
          adminNotes: adminNotes || undefined,
        }
      );

      if (response.data.success) {
        notifications.show({
          title: "Success",
          message: "Order confirmed and marked as completed",
          color: "green",
        });
        // Refresh order data
        const refreshResponse = await axiosInstance.get(
          `/api/image-orders/by-order-number?orderNumber=${orderNumber}`
        );
        if (refreshResponse.data.success) {
          setOrder(refreshResponse.data.order);
          setNewStatus("completed");
          setAdminNotes(refreshResponse.data.order.notes?.adminNotes || "");
        }
      }
    } catch (err) {
      console.error("Error confirming order:", err);
      notifications.show({
        title: "Error",
        message:
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Failed to confirm order",
        color: "red",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const response = await axiosInstance.put(
        `/api/image-orders/admin/${order._id}/status`,
        {
          status: newStatus,
          adminNotes: adminNotes || undefined,
        }
      );

      if (response.data.success) {
        notifications.show({
          title: "Success",
          message: "Order status updated successfully",
          color: "green",
        });
        // Refresh order data
        const refreshResponse = await axiosInstance.get(
          `/api/image-orders/by-order-number?orderNumber=${orderNumber}`
        );
        if (refreshResponse.data.success) {
          setOrder(refreshResponse.data.order);
        }
        closeStatusModal();
      }
    } catch (err) {
      console.error("Error updating status:", err);
      notifications.show({
        title: "Error",
        message:
          String(
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Failed to update order status"
          ),
        color: "red",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "green";
      case "processing":
        return "blue";
      case "paid":
        return "teal";
      case "pending":
        return "yellow";
      case "cancelled":
        return "red";
      default:
        return "gray";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getImageUrl = (filePath: string) => {
    if (filePath?.startsWith("http")) {
      return filePath;
    }
    const backendUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || "";
    if (filePath?.includes("public/uploads")) {
      return `${backendUrl}/${filePath}`;
    }
    return filePath?.startsWith("/") ? `${backendUrl}${filePath}` : `${backendUrl}/${filePath}`;
  };

  const handleDownloadAll = async () => {
    if (!order || !order.images || order.images.length === 0) return;

    setDownloadingAll(true);
    try {
      notifications.show({
        title: "Preparing",
        message: `Creating zip file with ${order.images.length} images...`,
        color: "blue",
      });

      const zip = new JSZip();
      let successCount = 0;
      let errorCount = 0;

      // Track used filenames to avoid duplicates
      const usedFileNames = new Set<string>();

      // Fetch all images in parallel
      const imagePromises = order.images.map(async (image, index) => {
        try {
          const imageUrl = getImageUrl(image.filePath);
          const response = await fetch(imageUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image ${index + 1}`);
          }
          
          const blob = await response.blob();
          const originalFileName = image.fileName || `image-${index + 1}`;
          
          // Get file extension from mimeType or fileName
          let extension = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
          if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            // Try to determine from mimeType
            const mimeType = image.mimeType || blob.type;
            if (mimeType) {
              if (mimeType.includes('jpeg')) extension = 'jpg';
              else if (mimeType.includes('png')) extension = 'png';
              else if (mimeType.includes('gif')) extension = 'gif';
              else if (mimeType.includes('webp')) extension = 'webp';
            }
          }
          
          // Clean filename and ensure uniqueness
          const cleanFileName = originalFileName.replace(/\.[^/.]+$/, '');
          let zipFileName = `${cleanFileName}.${extension}`;
          
          // Handle duplicate filenames
          let counter = 1;
          while (usedFileNames.has(zipFileName)) {
            zipFileName = `${cleanFileName}-${counter}.${extension}`;
            counter++;
          }
          usedFileNames.add(zipFileName);
          
          zip.file(zipFileName, blob);
          successCount++;
        } catch (err) {
          console.error(`Failed to add image ${index + 1} to zip:`, err);
          errorCount++;
        }
      });

      await Promise.all(imagePromises);

      if (successCount === 0) {
        throw new Error("Failed to fetch any images");
      }

      notifications.show({
        title: "Creating zip",
        message: "Generating zip file...",
        color: "blue",
      });

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link for zip file
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `order-${order.orderNumber}-images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: "Success",
        message: `Downloaded zip file with ${successCount} image(s)${errorCount > 0 ? ` (${errorCount} failed)` : ""}`,
        color: "green",
      });
    } catch (err) {
      console.error("Error creating zip file:", err);
      notifications.show({
        title: "Error",
        message: "Failed to create zip file. Please try again.",
        color: "red",
      });
    } finally {
      setDownloadingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" color="#2f5b48" />
          <Text mt="md" c="dimmed">Loading order details...</Text>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <Alert color="red" title="Error" icon={<XCircle />}>
            {error || "Order not found"}
          </Alert>
          <Button
            component={Link}
            href="/dashboard/image-orders"
            leftSection={<ArrowLeft className="w-4 h-4" />}
            mt="md"
          >
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Group justify="space-between" mb="md">
            <div>
              <Button
                component={Link}
                href="/dashboard/image-orders"
                variant="subtle"
                leftSection={<ArrowLeft className="w-4 h-4" />}
                mb="md"
              >
                Back to Orders
              </Button>
              <Title order={2} mb="xs">
                Order Details
              </Title>
              <Text c="dimmed">Order #{order.orderNumber}</Text>
            </div>
            <Group>
              <Badge
                color={getStatusColor(order.status)}
                size="xl"
                variant="light"
                className="capitalize"
              >
                {order.status}
              </Badge>
              {order.status !== "completed" && (
                <Button
                  leftSection={<CheckCircle2 className="w-4 h-4" />}
                  color="green"
                  onClick={handleConfirmOrder}
                  loading={updating}
                >
                  Confirm Order
                </Button>
              )}
              <Button
                leftSection={<Edit className="w-4 h-4" />}
                variant="outline"
                onClick={handleUpdateStatus}
              >
                Update Status
              </Button>
            </Group>
          </Group>
        </div>

        <Grid>
          {/* Left Column - Main Content */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="md">
              {/* Customer Information */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group mb="md">
                  <User className="w-5 h-5 text-[#2f5b48]" />
                  <Text fw={600} size="lg">
                    Customer Information
                  </Text>
                </Group>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" c="dimmed" mb={4}>
                      Name
                    </Text>
                    <Text fw={500}>{order.customer.name}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" c="dimmed" mb={4} className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                    </Text>
                    <Text fw={500}>{order.customer.email}</Text>
                  </Grid.Col>
                  {order.customer.phone && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text size="sm" c="dimmed" mb={4}>
                        Phone
                      </Text>
                      <Text fw={500}>{order.customer.phone}</Text>
                    </Grid.Col>
                  )}
                </Grid>
              </Card>

              {/* Order Information */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group mb="md">
                  <Package className="w-5 h-5 text-[#2f5b48]" />
                  <Text fw={600} size="lg">
                    Order Information
                  </Text>
                </Group>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" c="dimmed" mb={4}>
                      Order Number
                    </Text>
                    <Text fw={500} className="font-mono">
                      {order.orderNumber}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" c="dimmed" mb={4} className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Order Date
                    </Text>
                    <Text fw={500}>{formatDate(order.createdAt)}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" c="dimmed" mb={4}>
                      Total Images
                    </Text>
                    <Text fw={500} c="#2f5b48" size="lg">
                      {order.images?.length || order.pricing.totalImages || 0}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" c="dimmed" mb={4}>
                      Payment Status
                    </Text>
                    <Badge
                      color={
                        order.payment?.status === "completed" ? "green" : "yellow"
                      }
                      variant="light"
                    >
                      {order.payment?.status || "pending"}
                    </Badge>
                  </Grid.Col>
                </Grid>
              </Card>

              {/* Images Gallery */}
              {order.images && order.images.length > 0 && (
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Group justify="space-between" mb="md">
                    <Group>
                      <ImageIcon className="w-5 h-5 text-[#2f5b48]" />
                      <Text fw={600} size="lg">
                        Order Images ({order.images.length})
                      </Text>
                    </Group>
                    <Button
                      leftSection={<Download className="w-4 h-4" />}
                      variant="outline"
                      color="#2f5b48"
                      onClick={handleDownloadAll}
                      loading={downloadingAll}
                      size="sm"
                    >
                      Download All
                    </Button>
                  </Group>
                  <Grid>
                    {order.images.map((image, index) => {
                      const imageUrl = getImageUrl(image.filePath);
                      return (
                        <Grid.Col key={image._id || index} span={{ base: 6, sm: 4, md: 3 }}>
                          <div
                            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-[#2f5b48]"
                            onClick={() => setSelectedImage(imageUrl)}
                          >
                            <Image
                              src={imageUrl}
                              alt={image.fileName || `Image ${index + 1}`}
                              width={300}
                              height={300}
                              className="object-cover"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                              #{index + 1}
                            </div>
                          </div>
                        </Grid.Col>
                      );
                    })}
                  </Grid>
                </Card>
              )}

              {/* Notes */}
              {(order.notes?.customerNotes || order.notes?.adminNotes) && (
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Text fw={600} size="lg" mb="md">
                    Notes
                  </Text>
                  {order.notes.customerNotes && (
                    <div className="mb-4">
                      <Text size="sm" fw={500} mb="xs" c="dimmed">
                        Customer Notes
                      </Text>
                      <Card withBorder p="sm" className="bg-gray-50">
                        <Text size="sm">{order.notes.customerNotes}</Text>
                      </Card>
                    </div>
                  )}
                  {order.notes.adminNotes && (
                    <div>
                      <Text size="sm" fw={500} mb="xs" c="dimmed">
                        Admin Notes
                      </Text>
                      <Card withBorder p="sm" className="bg-blue-50">
                        <Text size="sm">{order.notes.adminNotes}</Text>
                      </Card>
                    </div>
                  )}
                </Card>
              )}
            </Stack>
          </Grid.Col>

          {/* Right Column - Summary & Actions */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="md">
              {/* Order Summary */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text fw={600} size="lg" mb="md">
                  Order Summary
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Images</Text>
                    <Text fw={500}>{order.pricing.totalImages}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Price per Image</Text>
                    <Text fw={500}>₹{order.pricing.pricePerImage}</Text>
                  </Group>
                  {order.pricing.discount > 0 && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Discount</Text>
                      <Text fw={500} c="green">
                        -₹{order.pricing.discount}
                      </Text>
                    </Group>
                  )}
                  <Divider />
                  <Group justify="space-between">
                    <Text fw={600} size="lg">Total</Text>
                    <Text fw={700} size="xl" c="#2f5b48">
                      ₹{order.pricing.finalAmount || 0}
                    </Text>
                  </Group>
                </Stack>
              </Card>

              {/* Payment Information */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text fw={600} size="lg" mb="md">
                  Payment Information
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Status</Text>
                    <Badge
                      color={
                        order.payment?.status === "completed" ? "green" : "yellow"
                      }
                      variant="light"
                    >
                      {order.payment?.status || "pending"}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Amount</Text>
                    <Text fw={500}>
                      ₹{order.payment?.amount || order.pricing.finalAmount || 0}
                    </Text>
                  </Group>
                  {order.payment?.method && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Method</Text>
                      <Text fw={500} className="capitalize">
                        {order.payment.method}
                      </Text>
                    </Group>
                  )}
                  {order.payment?.paidAt && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Paid On</Text>
                      <Text fw={500} size="sm">
                        {formatDate(order.payment.paidAt)}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Card>

              {/* Delivery Information */}
              {order.delivery && (
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Text fw={600} size="lg" mb="md">
                    Delivery Information
                  </Text>
                  <Stack gap="xs">
                    {order.delivery.expectedDelivery && (
                      <div>
                        <Text size="sm" c="dimmed" mb={4}>
                          Expected Delivery
                        </Text>
                        <Text fw={500}>{formatDate(order.delivery.expectedDelivery)}</Text>
                      </div>
                    )}
                    {order.delivery.actualDelivery && (
                      <div>
                        <Text size="sm" c="dimmed" mb={4}>
                          Delivered On
                        </Text>
                        <Text fw={500} c="green">
                          {formatDate(order.delivery.actualDelivery)}
                        </Text>
                      </div>
                    )}
                  </Stack>
                </Card>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </div>

      {/* Update Status Modal */}
      <Modal
        opened={statusModalOpened}
        onClose={closeStatusModal}
        title="Update Order Status"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Order Status"
            value={newStatus}
            onChange={(value) => setNewStatus(value || "")}
            data={[
              { value: "pending", label: "Pending" },
              { value: "payment_pending", label: "Payment Pending" },
              { value: "paid", label: "Paid" },
              { value: "processing", label: "Processing" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            required
          />
          <Textarea
            label="Admin Notes"
            placeholder="Add any notes about this order..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={4}
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={closeStatusModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveStatus}
              loading={updating}
              leftSection={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="relative w-full h-full aspect-video bg-black rounded-lg overflow-hidden">
              <Image
                src={selectedImage}
                alt="Full size preview"
                fill
                className="object-contain"
                sizes="90vw"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
