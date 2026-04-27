import axios from "axios";

export const API_BASE = "http://127.0.0.1:8000/api";

export async function getDashboardSummary() {
  const response = await axios.get(`${API_BASE}/dashboard-summary/`);
  return response.data;
}

export async function getInventory() {
  const response = await axios.get(`${API_BASE}/inventory/`);
  return response.data;
}

export async function getSuppliers() {
  const response = await axios.get(`${API_BASE}/suppliers/`);
  return response.data;
}

export async function getSupplierParts() {
  const response = await axios.get(`${API_BASE}/supplier-parts/`);
  return response.data;
}

export async function getParts() {
  const response = await axios.get(`${API_BASE}/parts/`);
  return response.data;
}

export async function createSupplier(payload) {
  const response = await axios.post(`${API_BASE}/suppliers/`, payload);
  return response.data;
}

export async function createSupplierPart(payload) {
  const response = await axios.post(`${API_BASE}/supplier-parts/`, payload);
  return response.data;
}

export async function getOrders() {
  const response = await axios.get(`${API_BASE}/orders/`);
  return response.data;
}

export async function getDefects() {
  const response = await axios.get(`${API_BASE}/defects/`);
  return response.data;
}

export async function getForecastParameters() {
  const response = await axios.get(`${API_BASE}/forecast-parameters/`, {
    params: { ordering: "parameter_name", is_active: true },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getUploads() {
  const response = await axios.get(`${API_BASE}/uploads/`, {
    params: { ordering: "-created_at" },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data?.results ?? [];
}

/** Multipart upload — backend route: POST /api/uploads/file/ */
export async function uploadDataFile(file) {
  const form = new FormData();
  form.append("file", file);
  const response = await axios.post(`${API_BASE}/uploads/file/`, form, {
    timeout: 120_000,
  });
  return response.data;
}

export async function reimportUpload(uploadId) {
  const response = await axios.post(`${API_BASE}/uploads/${uploadId}/reimport/`);
  return response.data;
}

export async function deleteUpload(uploadId) {
  await axios.delete(`${API_BASE}/uploads/${uploadId}/`);
}

export async function updateInventoryReorderPoint(snapshotId, reorderPointQty) {
  const response = await axios.patch(`${API_BASE}/inventory/${snapshotId}/`, {
    reorder_point_qty: reorderPointQty,
  });
  return response.data;
}
