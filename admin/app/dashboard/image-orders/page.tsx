"use client";

import React, { useState, useEffect } from "react";
import {
  Button,
  Group,
  Text,
  Title,
  Card,
  Grid,
  Badge,
  ActionIcon,
  Stack,
  Loader,
  TextInput,
  Select,
  Pagination,
  Table,
  Modal,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconFilter,
  IconEye,
  IconEdit,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";
import Image from "next/image";
import Link from "next/link";

interface ImageOrder {
  _id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  images: Array<{
    _id: string;
    filePath: string;
    fileName: string;
    mimeType: string;
  }>;
  status: string;
  payment: {
    status: string;
    amount: number;
    method?: string;
    transactionId?: string;
    paidAt?: string;
  };
  pricing: {
    totalImages: number;
    finalAmount: number;
  };
  createdAt: string;
  updatedAt: string;
  notes?: {
    customerNotes?: string;
    adminNotes?: string;
  };
}

export default function ImageOrdersPage() {
  const [orders, setOrders] = useState<ImageOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<ImageOrder | null>(null);
  const [viewModalOpened, { open: openViewModal, close: closeViewModal }] =
    useDisclosure(false);
  const [statusModalOpened, { open: openStatusModal, close: closeStatusModal }] =
    useDisclosure(false);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch orders
  const fetchOrders = async (page = 1, status = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (status) params.append("status", status);

      const response = await axiosInstance.get(
        `/api/image-orders/admin/all?${params}`
      );
      setOrders(response.data.orders || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
      setCurrentPage(response.data.pagination?.currentPage || 1);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to fetch orders",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(currentPage, filterStatus || "");
  }, [currentPage, filterStatus]);

  // Handle view order
  const handleViewOrder = (order: ImageOrder) => {
    setSelectedOrder(order);
    openViewModal();
  };

  // Handle update status
  const handleUpdateStatus = (order: ImageOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setAdminNotes(order.notes?.adminNotes || "");
    openStatusModal();
  };

  // Submit status update
  const handleSubmitStatusUpdate = async () => {
    if (!selectedOrder) return;

    try {
      await axiosInstance.put(
        `/api/image-orders/admin/${selectedOrder._id}/status`,
        {
          status: newStatus,
          adminNotes: adminNotes || undefined,
        }
      );
      notifications.show({
        title: "Success",
        message: "Order status updated successfully",
        color: "green",
      });
      closeStatusModal();
      fetchOrders(currentPage, filterStatus || "");
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to update status",
        color: "red",
      });
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "green";
      case "processing":
        return "blue";
      case "paid":
        return "teal";
      case "payment_pending":
        return "yellow";
      case "cancelled":
        return "red";
      default:
        return "gray";
    }
  };

  // Filter orders by search query
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customer.name.toLowerCase().includes(query) ||
      order.customer.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={1}>Image Orders</Title>
            <Text c="dimmed">Manage customer image orders</Text>
          </div>
        </Group>

        {/* Search and Filters */}
        <Card withBorder p="md" mb="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                placeholder="Search by order number, name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<IconSearch size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select
                placeholder="Filter by status"
                value={filterStatus}
                onChange={setFilterStatus}
                data={[
                  { value: "pending", label: "Pending" },
                  { value: "payment_pending", label: "Payment Pending" },
                  { value: "paid", label: "Paid" },
                  { value: "processing", label: "Processing" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 2 }}>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus(null);
                  setCurrentPage(1);
                  fetchOrders(1, "");
                }}
                size="sm"
                fullWidth
              >
                Reset
              </Button>
            </Grid.Col>
          </Grid>
        </Card>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card withBorder p="xl" className="text-center">
          <Text size="lg" c="dimmed" mb="md">
            No orders found
          </Text>
          <Text c="dimmed">
            {searchQuery || filterStatus
              ? "Try adjusting your search criteria"
              : "No orders have been placed yet"}
          </Text>
        </Card>
      ) : (
        <>
          <Card withBorder>
            <Table.ScrollContainer minWidth={800}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order Number</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Images</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Payment Status</Table.Th>
                    <Table.Th>Order Status</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredOrders.map((order) => (
                    <Table.Tr key={order._id}>
                      <Table.Td>
                        <Text fw={500} size="sm">
                          {order.orderNumber}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>
                            {order.customer.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {order.customer.email}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{order.images?.length || 0}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          ₹{order.pricing?.finalAmount || order.payment?.amount || 0}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            order.payment?.status === "completed"
                              ? "green"
                              : order.payment?.status === "pending"
                              ? "yellow"
                              : "red"
                          }
                          variant="light"
                          size="sm"
                        >
                          {order.payment?.status || "pending"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getStatusColor(order.status)}
                          variant="light"
                          size="sm"
                        >
                          {order.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            component={Link}
                            href={`/dashboard/image-orders/${order.orderNumber}`}
                            variant="subtle"
                            size="xs"
                            leftSection={<IconEye size={14} />}
                          >
                            View
                          </Button>
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            onClick={() => handleUpdateStatus(order)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
              />
            </Group>
          )}
        </>
      )}

      {/* View Order Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={closeViewModal}
        title={`Order Details - ${selectedOrder?.orderNumber}`}
        size="lg"
      >
        {selectedOrder && (
          <Stack gap="md">
            <div>
              <Text fw={500} size="sm" mb="xs">
                Customer Information
              </Text>
              <Card withBorder p="sm">
                <Text size="sm">
                  <strong>Name:</strong> {selectedOrder.customer.name}
                </Text>
                <Text size="sm">
                  <strong>Email:</strong> {selectedOrder.customer.email}
                </Text>
                {selectedOrder.customer.phone && (
                  <Text size="sm">
                    <strong>Phone:</strong> {selectedOrder.customer.phone}
                  </Text>
                )}
              </Card>
            </div>

            <div>
              <Text fw={500} size="sm" mb="xs">
                Order Information
              </Text>
              <Card withBorder p="sm">
                <Text size="sm">
                  <strong>Order Number:</strong> {selectedOrder.orderNumber}
                </Text>
                <Text size="sm">
                  <strong>Total Images:</strong> {selectedOrder.images?.length || 0}
                </Text>
                <Text size="sm">
                  <strong>Amount:</strong> ₹
                  {selectedOrder.pricing?.finalAmount ||
                    selectedOrder.payment?.amount ||
                    0}
                </Text>
                <Group mt="xs">
                  <Badge
                    color={getStatusColor(selectedOrder.status)}
                    variant="light"
                  >
                    {selectedOrder.status}
                  </Badge>
                  <Badge
                    color={
                      selectedOrder.payment?.status === "completed"
                        ? "green"
                        : "yellow"
                    }
                    variant="light"
                  >
                    Payment: {selectedOrder.payment?.status || "pending"}
                  </Badge>
                </Group>
              </Card>
            </div>

            {selectedOrder.images && selectedOrder.images.length > 0 && (
              <div>
                <Text fw={500} size="sm" mb="xs">
                  Images ({selectedOrder.images.length})
                </Text>
                <Grid>
                  {selectedOrder.images.map((image, index) => (
                    <Grid.Col key={image._id || index} span={4}>
                      <Card withBorder p="xs">
                        <div className="relative w-full aspect-square">
                          <Image
                            src={
                              image.filePath?.startsWith("http")
                                ? image.filePath
                                : `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/${image.filePath}`
                            }
                            alt={image.fileName || `Image ${index + 1}`}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              </div>
            )}

            {selectedOrder.notes?.customerNotes && (
              <div>
                <Text fw={500} size="sm" mb="xs">
                  Customer Notes
                </Text>
                <Card withBorder p="sm">
                  <Text size="sm">{selectedOrder.notes.customerNotes}</Text>
                </Card>
              </div>
            )}

            {selectedOrder.notes?.adminNotes && (
              <div>
                <Text fw={500} size="sm" mb="xs">
                  Admin Notes
                </Text>
                <Card withBorder p="sm">
                  <Text size="sm">{selectedOrder.notes.adminNotes}</Text>
                </Card>
              </div>
            )}
          </Stack>
        )}
      </Modal>

      {/* Update Status Modal */}
      <Modal
        opened={statusModalOpened}
        onClose={closeStatusModal}
        title={`Update Order Status - ${selectedOrder?.orderNumber}`}
      >
        {selectedOrder && (
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
              <Button onClick={handleSubmitStatusUpdate}>Update Status</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}
