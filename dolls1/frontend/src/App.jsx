import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import useMediaQuery from "@mui/material/useMediaQuery";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import TableSortLabel from "@mui/material/TableSortLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Pagination from "@mui/material/Pagination";
import Tooltip from "@mui/material/Tooltip";
import Grid from "@mui/material/Grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { alpha } from "@mui/material/styles";
import { unzipSync, strFromU8 } from "fflate";
import {
  API_BASE,
  getDashboardSummary,
  getInventory,
  getSuppliers,
  getSupplierParts,
  getParts,
  createSupplier,
  createSupplierPart,
  getDefects,
  getForecastParameters,
  getDemandForecastWorkbench,
  getOperationalWorkbench,
  createDefectEvent,
  createCapaCase,
  getUploads,
  uploadDataFile,
  reimportUpload,
  deleteUpload,
  updateInventoryReorderPoint,
} from "./api";
import { theme, appBarBackgroundImage } from "./theme.js";

const drawerWidth = 260;
/** Sidebar active item: violet (avoids success/warning/error alerts and typical chart greens-oranges-reds). */
const NAV_ACTIVE_BG = "#8574C4";
const NAV_ACTIVE_BG_HOVER = "#9A8BD4";
/** Hover on non-active items: lilac wash on dark violet sidebar. */
const NAV_HOVER_BG = "rgba(186, 174, 232, 0.32)";
/** Default nav label: soft lilac (not icy blue-gray). */
const NAV_LABEL = "rgba(232, 226, 252, 0.96)";
/** Pantone 178 C (approx.) — "Doll" wordmark */
const PANTONE_178 = "#EE2737";
const primaryMain = theme.palette.primary.main;
const primaryDark = theme.palette.primary.dark;
const TOOLTIP_DELAY_PROPS = {
  enterDelay: 250,
  leaveDelay: 60,
  enterNextDelay: 120,
  enterTouchDelay: 600,
  leaveTouchDelay: 900,
};

/** Shared card chrome for KPIs, section cards, and data tables (used across all pages). */
const CARD_POLISH_SX = {
  border: "1px solid rgba(15, 23, 42, 0.09)",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

const PAGE_MAX_WIDTH_PX = 1280;

const navItems = [
  ["Dashboard", "/"],
  ["Upload Data", "/upload"],
  ["Inventory", "/inventory"],
  ["Forecasting", "/forecasting"],
  ["Orders & Targets", "/orders"],
  ["Suppliers", "/suppliers"],
  ["Quality / Six Sigma", "/quality"],
  ["Settings", "/settings"],
];

const mockSummary = {
  total_orders: 1240,
  shipped_orders: 1196,
  on_time_48h_rate: 0.991,
  total_defects: 58,
  configuration_accuracy: 0.982,
  estimated_dpmo: 3900,
  inventory_records: 220,
  supplier_count: 24,
  recommendation_count: 42,
  risk_level: "green",
};

/** Matches `Part.PART_TYPES` ordering in Django — group parts consistently across pages. */
const PART_TYPE_ORDER = ["head", "arm", "leg", "hair", "eyes", "outfit", "glasses", "torso", "packaging"];

const PART_TYPE_LABELS = {
  head: "Head",
  arm: "Arm",
  leg: "Leg",
  hair: "Hair",
  eyes: "Eyes",
  outfit: "Outfit",
  glasses: "Glasses",
  torso: "Torso",
  packaging: "Packaging",
};

function partTypeSortIndex(partType) {
  const t = String(partType || "").toLowerCase();
  const i = PART_TYPE_ORDER.indexOf(t);
  return i === -1 ? PART_TYPE_ORDER.length + 1 : i;
}

function inferPartTypeFromName(partName, partNumber = "") {
  const text = `${partName} ${partNumber}`.toLowerCase();
  if (text.includes("torso")) return "torso";
  if (text.includes("box") || text.includes("ribbon")) return "packaging";
  if (text.includes("arm")) return "arm";
  if (text.includes("leg")) return "leg";
  if (text.includes("hair")) return "hair";
  if (text.includes("eye")) return "eyes";
  if (text.includes("outfit")) return "outfit";
  if (text.includes("glass")) return "glasses";
  if (text.includes("pack")) return "packaging";
  return "head";
}

function formatPartTypeLabel(partType) {
  const key = String(partType || "").toLowerCase();
  return PART_TYPE_LABELS[key] ?? (partType ? String(partType) : "—");
}

function compareByBodyPartThenName(typeA, nameA, typeB, nameB) {
  const c = partTypeSortIndex(typeA) - partTypeSortIndex(typeB);
  if (c !== 0) return c;
  return String(nameA || "").localeCompare(String(nameB || ""), undefined, { sensitivity: "base" });
}

function getInventoryRowSortMeta(row) {
  const detail = row.part_detail;
  if (detail) {
    return { type: detail.part_type, name: detail.part_name ?? "" };
  }
  const fallbackName = typeof row.part === "string" ? row.part : "";
  return { type: inferPartTypeFromName(fallbackName), name: fallbackName };
}

function compareInventorySnapshotRows(a, b) {
  const ma = getInventoryRowSortMeta(a);
  const mb = getInventoryRowSortMeta(b);
  return compareByBodyPartThenName(ma.type, ma.name, mb.type, mb.name);
}

function compareSupplierPartLinks(a, b) {
  const pa = a.part_detail;
  const pb = b.part_detail;
  const sa = a.supplier_detail?.supplier_name ?? "";
  const sb = b.supplier_detail?.supplier_name ?? "";
  if (pa && pb) {
    const c = compareByBodyPartThenName(pa.part_type, pa.part_name, pb.part_type, pb.part_name);
    if (c !== 0) return c;
  } else if (pa) return -1;
  else if (pb) return 1;
  return String(sa).localeCompare(String(sb), undefined, { sensitivity: "base" });
}

/** Aggregate supplier-parts for a supplier: lead mean/std and on-time delivery. */
function computeLeadTimeRiskFromPartLinks(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return {
      band: "unknown",
      chipLabel: "N/A",
      caption: "No supplier-part rows — import or link parts to score lead time.",
      sortValue: "0",
      searchText: "lead time N/A",
    };
  }
  const upperTails = [];
  const otds = [];
  for (const l of links) {
    const m = Number(l.lead_time_days_mean ?? 0);
    const s = Number(l.lead_time_days_std ?? 0);
    let otd = Number(l.on_time_delivery_rate ?? 1);
    if (otd > 1 && otd <= 100) otd /= 100;
    upperTails.push(m + s);
    otds.push(Number.isFinite(otd) ? otd : 1);
  }
  const worstDays = Math.max(...upperTails);
  const minOtd = Math.min(...otds);
  let band;
  if (worstDays <= 20 && minOtd >= 0.9) band = "green";
  else if (worstDays <= 28 && minOtd >= 0.82) band = "yellow";
  else band = "red";
  const chipLabel = band === "green" ? "Low" : band === "yellow" ? "Moderate" : "High";
  const caption = `Tail ≈ ${worstDays.toFixed(0)} d (mean + σ) · worst OTD ${(minOtd * 100).toFixed(0)}%`;
  const sortValue = band === "green" ? "1" : band === "yellow" ? "2" : "3";
  return {
    band,
    chipLabel,
    caption,
    sortValue,
    searchText: `lead time ${chipLabel} ${caption}`,
  };
}

/** Rich table cell: risk band + metrics (for All Suppliers → Lead Time Risk). */
function leadTimeRiskReviewCell(links) {
  const r = computeLeadTimeRiskFromPartLinks(links);
  const chipColor =
    r.band === "green" ? "success" : r.band === "yellow" ? "warning" : r.band === "red" ? "error" : "default";
  return {
    sortValue: r.sortValue,
    searchText: r.searchText,
    display: (
      <Stack alignItems="flex-start" spacing={0.5}>
        <Chip size="small" color={chipColor} label={r.chipLabel} sx={{ height: 22, fontSize: "0.7rem" }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25, maxWidth: 240, display: "block" }}>
          {r.caption}
        </Typography>
      </Stack>
    ),
  };
}

/** Duty exposure from supplier-parts tariff_rate (model: peak line drives compliance cost risk). */
function computeTariffRiskFromPartLinks(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return {
      band: "unknown",
      chipLabel: "N/A",
      caption: "No supplier-part rows — import or link parts to score tariff exposure.",
      sortValue: "0",
      searchText: "tariff N/A",
    };
  }
  const rates = [];
  for (const l of links) {
    let r = Number(l.tariff_rate ?? 0);
    if (r > 1 && r <= 100) r /= 100;
    if (!Number.isFinite(r) || r < 0) r = 0;
    rates.push(r);
  }
  const maxTariff = Math.max(...rates);
  const avgTariff = rates.reduce((a, b) => a + b, 0) / rates.length;
  let band;
  if (maxTariff <= 0.05) band = "green";
  else if (maxTariff <= 0.15) band = "yellow";
  else band = "red";
  const chipLabel = band === "green" ? "Low" : band === "yellow" ? "Moderate" : "High";
  const caption = `Peak duty ${(maxTariff * 100).toFixed(1)}% · line avg ${(avgTariff * 100).toFixed(1)}%`;
  const sortValue = band === "green" ? "1" : band === "yellow" ? "2" : "3";
  return {
    band,
    chipLabel,
    caption,
    sortValue,
    searchText: `tariff ${chipLabel} ${caption}`,
  };
}

function tariffRiskReviewCell(links) {
  const r = computeTariffRiskFromPartLinks(links);
  const chipColor =
    r.band === "green" ? "success" : r.band === "yellow" ? "warning" : r.band === "red" ? "error" : "default";
  return {
    sortValue: r.sortValue,
    searchText: r.searchText,
    display: (
      <Stack alignItems="flex-start" spacing={0.5}>
        <Chip size="small" color={chipColor} label={r.chipLabel} sx={{ height: 22, fontSize: "0.7rem" }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25, maxWidth: 240, display: "block" }}>
          {r.caption}
        </Typography>
      </Stack>
    ),
  };
}

function compareRiskBandChip(band, label) {
  const color =
    band === "green" ? "success" : band === "yellow" ? "warning" : band === "red" ? "error" : "default";
  return <Chip size="small" variant="outlined" color={color} label={label} sx={{ height: 24, fontWeight: 700 }} />;
}

/** Per-supplier aggregates for Compare Suppliers (same signals as Lead / Tariff risk columns). */
function buildSupplierCompareAnalytics(supplier, links) {
  const lead = computeLeadTimeRiskFromPartLinks(links);
  const tariff = computeTariffRiskFromPartLinks(links);
  const lineCount = links.length;
  const primaryCount = links.filter((l) => l.is_primary).length;
  let avgUnit = null;
  let avgLanded = null;
  let worstTail = null;
  let minOtd = null;
  let peakDutyPct = null;
  let avgDutyPct = null;
  if (links.length) {
    const landeds = links.map((l) => {
      const base = Number(l.base_cost ?? 0);
      const ship = Number(l.shipping_cost_per_unit ?? 0);
      let tr = Number(l.tariff_rate ?? 0);
      if (tr > 1 && tr <= 100) tr /= 100;
      return base + ship + base * tr;
    });
    avgLanded = landeds.reduce((a, b) => a + b, 0) / landeds.length;
    avgUnit = links.reduce((a, l) => a + Number(l.base_cost ?? 0), 0) / links.length;
    worstTail = Math.max(
      ...links.map((l) => Number(l.lead_time_days_mean ?? 0) + Number(l.lead_time_days_std ?? 0))
    );
    const otds = links.map((l) => {
      let o = Number(l.on_time_delivery_rate ?? 1);
      if (o > 1 && o <= 100) o /= 100;
      return Number.isFinite(o) ? o : 1;
    });
    minOtd = Math.min(...otds);
    const rates = links.map((l) => {
      let r = Number(l.tariff_rate ?? 0);
      if (r > 1 && r <= 100) r /= 100;
      return Number.isFinite(r) && r >= 0 ? r : 0;
    });
    peakDutyPct = Math.max(...rates) * 100;
    avgDutyPct = (rates.reduce((a, b) => a + b, 0) / rates.length) * 100;
  }
  const certSummary = [
    supplier.cpsia_current ? "CPSC" : null,
    supplier.astm_f963_current ? "ASTM" : null,
    supplier.iso_9001_current ? "ISO 9001" : null,
    supplier.oeko_tex_current ? "Oeko-Tex" : null,
    supplier.foam_cert_current ? "Foam" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    lead,
    tariff,
    lineCount,
    primaryCount,
    avgUnit,
    avgLanded,
    worstTail,
    minOtd,
    peakDutyPct,
    avgDutyPct,
    certSummary: certSummary || "—",
  };
}

function SupplierCompareDialog({ open, onClose, source, suppliers, linksBySupplierId }) {
  const analyticsRows = useMemo(() => {
    if (!suppliers.length || Array.isArray(suppliers[0])) return [];
    return [...suppliers]
      .map((s) => {
        const links = linksBySupplierId.get(s.id) ?? [];
        return { supplier: s, ...buildSupplierCompareAnalytics(s, links) };
      })
      .sort((a, b) =>
        String(a.supplier.supplier_name || "").localeCompare(String(b.supplier.supplier_name || ""), undefined, {
          sensitivity: "base",
        })
      );
  }, [suppliers, linksBySupplierId]);

  const fmtUsd = (n) =>
    n == null || Number.isNaN(n)
      ? "—"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth aria-labelledby="supplier-compare-title">
      <DialogTitle id="supplier-compare-title">Compare Suppliers</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Side-by-side view uses the same inputs as the All Suppliers table:{" "}
            <strong>supplier master</strong> (country, certification flags) and{" "}
            <strong>supplier–part lines</strong> (unit cost, shipping, tariff rate, lead mean/σ, on-time delivery, primary flag).
            Estimated landed unit cost is{" "}
            <Typography component="span" variant="body2" sx={{ fontStyle: "italic" }}>
              base + shipping + base × duty
            </Typography>
            . Lead time risk uses max(mean + σ) and minimum OTD across lines; tariff risk uses peak duty and line-average duty.
          </Typography>
          {source !== "live" ? (
            <Alert severity="info">API data is offline — open this view when connected for full metrics.</Alert>
          ) : null}
          {analyticsRows.length ? (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader aria-label="Supplier comparison">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Country</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Lines
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Primary
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Avg base
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Avg landed*
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Lead tail (d)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Worst OTD
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Peak duty
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Certifications</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Lead risk</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tariff risk</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analyticsRows.map((row) => (
                    <TableRow key={row.supplier.id} hover>
                      <TableCell>{row.supplier.supplier_name}</TableCell>
                      <TableCell>{row.supplier.country}</TableCell>
                      <TableCell align="right">{row.lineCount || "—"}</TableCell>
                      <TableCell align="right">{row.lineCount ? row.primaryCount : "—"}</TableCell>
                      <TableCell align="right">{fmtUsd(row.avgUnit)}</TableCell>
                      <TableCell align="right">{fmtUsd(row.avgLanded)}</TableCell>
                      <TableCell align="right">
                        {row.worstTail != null ? row.worstTail.toFixed(0) : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {row.minOtd != null ? `${(row.minOtd * 100).toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {row.peakDutyPct != null ? `${row.peakDutyPct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ display: "block", lineHeight: 1.35 }}>
                          {row.certSummary}
                        </Typography>
                      </TableCell>
                      <TableCell>{compareRiskBandChip(row.lead.band, row.lead.chipLabel)}</TableCell>
                      <TableCell>{compareRiskBandChip(row.tariff.band, row.tariff.chipLabel)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">No supplier records to compare.</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Static analytics CSV (run: `python manage.py generate_frequent_supplier_analytics`). */
const FREQUENT_CSV_BASE = `${import.meta.env.BASE_URL}dolls1_seed/`;

function parseSimpleCsv(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = String(cells[j] ?? "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

function MultiSeriesUsdLineChart({ xLabels, series, title, yLabel = "USD / unit" }) {
  const w = 680;
  const h = 280;
  const padL = 52;
  const padR = 24;
  const padT = 28;
  const padB = 44;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const all = series.flatMap((s) => s.values);
  const rawMin = Math.min(...all, 0);
  const rawMax = Math.max(...all, 0.01);
  const padY = (rawMax - rawMin) * 0.08 || 0.5;
  const minV = Math.max(0, rawMin - padY);
  const maxV = rawMax + padY;
  const rng = maxV - minV || 1;
  const xStep = plotW / Math.max(1, xLabels.length - 1);

  const pathFor = (values) =>
    values
      .map((v, i) => {
        const x = padL + i * xStep;
        const y = padT + plotH - ((Number(v) - minV) / rng) * plotH;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={title}>
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#94a3b8" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#94a3b8" />
        <text x={padL - 6} y={padT + 6} fontSize="11" fill="#64748b" textAnchor="end">
          {maxV.toFixed(2)}
        </text>
        <text x={padL - 6} y={padT + plotH} fontSize="11" fill="#64748b" textAnchor="end">
          {minV.toFixed(2)}
        </text>
        <text x={padL} y={h - 10} fontSize="11" fill="#64748b">
          {yLabel}
        </text>
        {series.map((s) => (
          <path key={s.name} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {xLabels.map((lab, i) => (
          <text
            key={lab}
            x={padL + i * xStep}
            y={padT + plotH + 22}
            fontSize="12"
            fill="#334155"
            textAnchor="middle"
          >
            {lab}
          </text>
        ))}
      </svg>
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", mt: 1 }}>
        {series.map((s) => (
          <Stack key={s.name} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 14, height: 3, bgcolor: s.color, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {s.name}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function FrequentSupplierDialog({ open, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [freqRows, setFreqRows] = useState([]);
  const [histRows, setHistRows] = useState([]);
  const [selectedPart, setSelectedPart] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setBusy(true);
    setErr(null);
    Promise.all([
      fetch(`${FREQUENT_CSV_BASE}part_frequent_supplier_last_fy.csv`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      }),
      fetch(`${FREQUENT_CSV_BASE}part_price_shipping_history_4y.csv`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      }),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        const f = parseSimpleCsv(a);
        const h = parseSimpleCsv(b);
        setFreqRows(f);
        setHistRows(h);
        setSelectedPart((prev) => (prev && f.some((row) => row.part_number === prev) ? prev : f[0]?.part_number ?? ""));
      })
      .catch(() => {
        if (!cancelled) {
          setErr(
            "Could not load CSV analytics. From dolls1/backend run: python manage.py generate_frequent_supplier_analytics"
          );
          setFreqRows([]);
          setHistRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const freqForPart = useMemo(
    () => freqRows.find((r) => r.part_number === selectedPart),
    [freqRows, selectedPart]
  );

  const chartPack = useMemo(() => {
    if (!selectedPart || !histRows.length) return null;
    const slice = histRows
      .filter((r) => r.part_number === selectedPart)
      .sort((a, b) => Number(a.calendar_year) - Number(b.calendar_year));
    if (!slice.length) return null;
    return {
      labels: slice.map((r) => r.calendar_year),
      base: slice.map((r) => Number(r.unit_base_cost_usd)),
      ship: slice.map((r) => Number(r.shipping_per_unit_usd)),
      total: slice.map((r) => Number(r.total_unit_usd)),
    };
  }, [selectedPart, histRows]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="frequent-supplier-title">
      <DialogTitle id="frequent-supplier-title">Frequent Supplier</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Most-used supplier per part for the <strong>last closed fiscal year</strong> is <strong>simulated</strong> from
            seeded weights (deterministic per part and supplier).{" "}
            <strong>2023–2026 unit base and shipping</strong> use your current{" "}
            <Typography component="span" variant="body2" sx={{ fontStyle: "italic" }}>
              supplier_parts
            </Typography>{" "}
            prices for <strong>2026</strong>; earlier years are back-cast from those anchors. Totals = base + shipping
            (duty excluded).
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Source files:{" "}
            <Typography component="span" variant="caption" sx={{ fontFamily: "monospace" }}>
              data/dolls1_seed_csv/part_frequent_supplier_last_fy.csv
            </Typography>
            ,{" "}
            <Typography component="span" variant="caption" sx={{ fontFamily: "monospace" }}>
              part_price_shipping_history_4y.csv
            </Typography>
          </Typography>
          {err ? <Alert severity="warning">{err}</Alert> : null}
          {busy ? <CircularProgress size={28} sx={{ alignSelf: "center" }} /> : null}
          {!busy && !err && freqRows.length ? (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260 }}>
                <Table size="small" stickyHeader aria-label="Frequent supplier by part">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Part</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>FY</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Frequent supplier</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Sim. lines
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Share %
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {freqRows.map((r) => (
                      <TableRow
                        key={r.part_number}
                        hover
                        selected={r.part_number === selectedPart}
                        onClick={() => setSelectedPart(r.part_number)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>{r.part_name}</TableCell>
                        <TableCell>{r.part_number}</TableCell>
                        <TableCell>{r.fiscal_year_label}</TableCell>
                        <TableCell>
                          {r.frequent_supplier_name}
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {r.frequent_supplier_code}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{r.simulated_order_lines_last_fy}</TableCell>
                        <TableCell align="right">{r.simulated_share_of_part_volume_pct}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <FormControl size="small" sx={{ minWidth: 280 }}>
                <InputLabel id="frequent-part-label">Part for price history</InputLabel>
                <Select
                  labelId="frequent-part-label"
                  label="Part for price history"
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(e.target.value)}
                >
                  {freqRows.map((r) => (
                    <MenuItem key={r.part_number} value={r.part_number}>
                      {r.part_name} ({r.part_number})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {freqForPart ? (
                <Typography variant="body2">
                  <strong>Frequent supplier:</strong> {freqForPart.frequent_supplier_name} — chart uses this vendor’s
                  unit economics.
                </Typography>
              ) : null}
              {chartPack ? (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "#fafbfc" }}>
                  <MultiSeriesUsdLineChart
                    title={`${freqForPart?.part_name ?? selectedPart} — 4-year unit cost`}
                    xLabels={chartPack.labels}
                    series={[
                      { name: "Unit base", values: chartPack.base, color: "#2563eb" },
                      { name: "Shipping / unit", values: chartPack.ship, color: "#ea580c" },
                      { name: "Base + shipping", values: chartPack.total, color: "#059669" },
                    ]}
                  />
                </Paper>
              ) : (
                <Typography color="text.secondary">No history rows for this part.</Typography>
              )}
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatSupplierApiError(err) {
  const d = err?.response?.data;
  if (d == null) return err?.message || "Request failed.";
  if (typeof d === "string") return d;
  if (Array.isArray(d.detail)) return d.detail.join(", ");
  if (typeof d === "object") {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("; ");
  }
  return String(d);
}

function defaultBackupSupplierForm() {
  return {
    supplier_code: "",
    supplier_name: "",
    country: "",
    iso_9001_current: false,
    cpsia_current: false,
    astm_f963_current: false,
    oeko_tex_current: false,
    foam_cert_current: false,
    certification_expiry: "",
    supplier_score: "0",
    add_part_link: true,
    part_id: "",
    supplier_part_number: "",
    base_cost: "",
    shipping_cost_per_unit: "0",
    tariff_rate: "0",
    lead_time_days_mean: "14",
    lead_time_days_std: "3",
    minimum_order_quantity: "1",
    order_multiple: "1",
    capacity_per_month: "8000",
    on_time_delivery_rate: "1",
    supplier_dpmo: "0",
    is_primary: false,
  };
}

function AddBackupSupplierDialog({ open, onClose, onCreated, source }) {
  const [f, setF] = useState(defaultBackupSupplierForm);
  const [parts, setParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setField = (key, value) => setF((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setF(defaultBackupSupplierForm());
    setError(null);
    setPartsLoading(true);
    getParts()
      .then((data) => {
        const list = data.results ?? data;
        setParts(Array.isArray(list) ? list : []);
      })
      .catch(() => setParts([]))
      .finally(() => setPartsLoading(false));
  }, [open]);

  const sortedParts = useMemo(
    () =>
      [...parts].sort((a, b) =>
        String(a.part_name ?? "").localeCompare(String(b.part_name ?? ""), undefined, { sensitivity: "base" })
      ),
    [parts]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    const code = f.supplier_code.trim();
    const name = f.supplier_name.trim();
    const country = f.country.trim();
    if (!code || !name || !country) {
      setError("Supplier code, supplier name, and country are required.");
      return;
    }
    if (f.add_part_link) {
      if (!f.part_id) {
        setError("Select a part for the backup link, or turn off “Add initial supplier–part link”.");
        return;
      }
      if (f.base_cost === "" || Number.isNaN(Number(f.base_cost))) {
        setError("Unit base cost is required when adding a supplier–part link.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const supplierPayload = {
        supplier_code: code,
        supplier_name: name,
        country,
        iso_9001_current: f.iso_9001_current,
        cpsia_current: f.cpsia_current,
        astm_f963_current: f.astm_f963_current,
        oeko_tex_current: f.oeko_tex_current,
        foam_cert_current: f.foam_cert_current,
        supplier_score: f.supplier_score || "0",
      };
      if (f.certification_expiry) supplierPayload.certification_expiry = f.certification_expiry;

      const created = await createSupplier(supplierPayload);
      const supplierId = created.id;

      if (f.add_part_link && f.part_id) {
        const part = parts.find((p) => String(p.id) === String(f.part_id));
        const spn =
          f.supplier_part_number.trim() ||
          (part ? `${part.part_number}-${code}` : `${f.part_id}-${code}`);
        await createSupplierPart({
          supplier: supplierId,
          part: Number(f.part_id),
          supplier_part_number: spn.slice(0, 100),
          base_cost: String(f.base_cost),
          shipping_cost_per_unit: String(f.shipping_cost_per_unit || "0"),
          tariff_rate: String(f.tariff_rate || "0"),
          lead_time_days_mean: String(f.lead_time_days_mean || "14"),
          lead_time_days_std: String(f.lead_time_days_std || "3"),
          minimum_order_quantity: Math.max(1, parseInt(f.minimum_order_quantity, 10) || 1),
          order_multiple: Math.max(1, parseInt(f.order_multiple, 10) || 1),
          capacity_per_month: Math.max(0, parseInt(f.capacity_per_month, 10) || 0),
          on_time_delivery_rate: String(f.on_time_delivery_rate ?? "1"),
          supplier_dpmo: String(f.supplier_dpmo || "0"),
          is_primary: Boolean(f.is_primary),
        });
      }

      await onCreated();
      onClose();
    } catch (e) {
      setError(formatSupplierApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="add-backup-supplier-title">
      <DialogTitle id="add-backup-supplier-title">Add Backup Supplier</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent dividers>
          <Stack spacing={2}>
            {source !== "live" ? (
              <Alert severity="info">
                Supplier list above may be offline. Saving still calls the API — ensure the backend is running and
                authenticated if your deployment requires it.
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              Creates a <strong>Supplier</strong> row (shown under All Suppliers) and optionally one{" "}
              <strong>supplier–part</strong> line so Lead Time Risk and Tariff Risk can be computed from unit economics.
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Supplier identity
            </Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Supplier code"
                  value={f.supplier_code}
                  onChange={(e) => setField("supplier_code", e.target.value)}
                  required
                  fullWidth
                  size="small"
                  placeholder="e.g. SUP_BACKUP_01"
                  helperText="Unique ID (matches supplier_code in imports)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Supplier name"
                  value={f.supplier_name}
                  onChange={(e) => setField("supplier_name", e.target.value)}
                  required
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Country"
                  value={f.country}
                  onChange={(e) => setField("country", e.target.value)}
                  required
                  fullWidth
                  size="small"
                  placeholder="e.g. USA"
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Certifications (Supplier Risk / compliance)
            </Typography>
            <FormGroup sx={{ pl: 0.5 }}>
              <FormControlLabel
                control={<Checkbox checked={f.iso_9001_current} onChange={(e) => setField("iso_9001_current", e.target.checked)} />}
                label="ISO 9001 current"
              />
              <FormControlLabel
                control={<Checkbox checked={f.cpsia_current} onChange={(e) => setField("cpsia_current", e.target.checked)} />}
                label="CPSIA (CPSC) current — drives “Certification” column when true"
              />
              <FormControlLabel
                control={<Checkbox checked={f.astm_f963_current} onChange={(e) => setField("astm_f963_current", e.target.checked)} />}
                label="ASTM F-963 current"
              />
              <FormControlLabel
                control={<Checkbox checked={f.oeko_tex_current} onChange={(e) => setField("oeko_tex_current", e.target.checked)} />}
                label="Oeko-Tex current"
              />
              <FormControlLabel
                control={<Checkbox checked={f.foam_cert_current} onChange={(e) => setField("foam_cert_current", e.target.checked)} />}
                label="Low-emission foam cert current"
              />
            </FormGroup>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Certification expiry"
                  type="date"
                  value={f.certification_expiry}
                  onChange={(e) => setField("certification_expiry", e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Supplier score"
                  value={f.supplier_score}
                  onChange={(e) => setField("supplier_score", e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Internal score (decimal)"
                />
              </Grid>
            </Grid>

            <Divider />
            <FormControlLabel
              control={
                <Checkbox checked={f.add_part_link} onChange={(e) => setField("add_part_link", e.target.checked)} />
              }
              label="Add initial supplier–part link (recommended for Lead / Tariff risk on this page)"
            />

            {f.add_part_link ? (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Supplier–part economics
                </Typography>
                <FormControl size="small" fullWidth disabled={partsLoading}>
                  <InputLabel id="backup-part-label">Part (SKU)</InputLabel>
                  <Select
                    labelId="backup-part-label"
                    label="Part (SKU)"
                    value={f.part_id}
                    onChange={(e) => setField("part_id", e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Select part…</em>
                    </MenuItem>
                    {sortedParts.map((p) => (
                      <MenuItem key={p.id} value={String(p.id)}>
                        {p.part_name} ({p.part_number}) · {p.part_type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {partsLoading ? <Typography variant="caption">Loading parts…</Typography> : null}

                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Supplier part number"
                      value={f.supplier_part_number}
                      onChange={(e) => setField("supplier_part_number", e.target.value)}
                      fullWidth
                      size="small"
                      helperText="Optional; defaults to {SKU}-{supplier code}"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControlLabel
                      control={
                        <Checkbox checked={f.is_primary} onChange={(e) => setField("is_primary", e.target.checked)} />
                      }
                      label="Primary for this part"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Unit base cost (USD)"
                      value={f.base_cost}
                      onChange={(e) => setField("base_cost", e.target.value)}
                      fullWidth
                      size="small"
                      required
                      inputProps={{ inputMode: "decimal" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Shipping / unit (USD)"
                      value={f.shipping_cost_per_unit}
                      onChange={(e) => setField("shipping_cost_per_unit", e.target.value)}
                      fullWidth
                      size="small"
                      inputProps={{ inputMode: "decimal" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Tariff rate (0–1)"
                      value={f.tariff_rate}
                      onChange={(e) => setField("tariff_rate", e.target.value)}
                      fullWidth
                      size="small"
                      helperText="Decimal duty on base (e.g. 0.05)"
                      inputProps={{ inputMode: "decimal" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Lead time mean (days)"
                      value={f.lead_time_days_mean}
                      onChange={(e) => setField("lead_time_days_mean", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Lead time σ (days)"
                      value={f.lead_time_days_std}
                      onChange={(e) => setField("lead_time_days_std", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="On-time delivery (0–1)"
                      value={f.on_time_delivery_rate}
                      onChange={(e) => setField("on_time_delivery_rate", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="MOQ"
                      value={f.minimum_order_quantity}
                      onChange={(e) => setField("minimum_order_quantity", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Order multiple"
                      value={f.order_multiple}
                      onChange={(e) => setField("order_multiple", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Capacity / month"
                      value={f.capacity_per_month}
                      onChange={(e) => setField("capacity_per_month", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Supplier DPMO"
                      value={f.supplier_dpmo}
                      onChange={(e) => setField("supplier_dpmo", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save supplier"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function compareDefectRecords(a, b) {
  const pa = a.part_detail;
  const pb = b.part_detail;
  if (pa && pb) {
    const c = compareByBodyPartThenName(pa.part_type, pa.part_name, pb.part_type, pb.part_name);
    if (c !== 0) return c;
  } else if (pa) return -1;
  else if (pb) return 1;
  const da = String(a.defect_type_detail?.defect_name ?? "");
  const db = String(b.defect_type_detail?.defect_name ?? "");
  return da.localeCompare(db, undefined, { sensitivity: "base" });
}

const SETTINGS_PARAM_OVERRIDES_KEY = "dolls_settings_parameter_overrides";

function loadRawParameterOverrides() {
  try {
    const raw = localStorage.getItem(SETTINGS_PARAM_OVERRIDES_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

/** Fallback when API is down or daily/weekly tables are empty before seed import. */
const MOCK_OPERATIONAL = {
  forecast_parameter_map: {
    on_time_ship_target: 0.98,
    target_rty: 0.95,
    min_cpk: 1.33,
    configuration_accuracy_target: 0.99,
    dpmo_target: 3400,
    ship_within_hours: 48,
    service_level_target: 0.95,
    default_safety_stock_days: 14,
    mega_promo_multiplier: 3,
    quality_cpk_current: 1.21,
  },
  forecast_parameters: [],
  daily_operations: [
    { target_date: "2026-04-14", target_orders: 42, actual_orders: 42, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 10, on_time_ship_rate: 0.984, season_window: "Normal" },
    { target_date: "2026-04-15", target_orders: 42, actual_orders: 41, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 9, on_time_ship_rate: 0.985, season_window: "Normal" },
    { target_date: "2026-04-16", target_orders: 42, actual_orders: 43, target_assembled: 42, actual_assembled: 44, target_shipped: 42, actual_shipped: 43, backlog_qty: 9, on_time_ship_rate: 0.986, season_window: "Normal" },
    { target_date: "2026-04-17", target_orders: 42, actual_orders: 42, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 44, backlog_qty: 8, on_time_ship_rate: 0.987, season_window: "Normal" },
    { target_date: "2026-04-18", target_orders: 42, actual_orders: 43, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 8, on_time_ship_rate: 0.988, season_window: "Normal" },
    { target_date: "2026-04-19", target_orders: 42, actual_orders: 41, target_assembled: 42, actual_assembled: 42, target_shipped: 42, actual_shipped: 43, backlog_qty: 7, on_time_ship_rate: 0.989, season_window: "Normal" },
    { target_date: "2026-04-20", target_orders: 42, actual_orders: 42, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 7, on_time_ship_rate: 0.99, season_window: "Normal" },
    { target_date: "2026-04-21", target_orders: 42, actual_orders: 43, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 6, on_time_ship_rate: 0.991, season_window: "Normal" },
    { target_date: "2026-04-22", target_orders: 42, actual_orders: 41, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 6, on_time_ship_rate: 0.992, season_window: "Normal" },
    { target_date: "2026-04-23", target_orders: 42, actual_orders: 42, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 5, on_time_ship_rate: 0.992, season_window: "Normal" },
    { target_date: "2026-04-24", target_orders: 42, actual_orders: 43, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 44, backlog_qty: 5, on_time_ship_rate: 0.993, season_window: "Normal" },
    { target_date: "2026-04-25", target_orders: 42, actual_orders: 41, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 5, on_time_ship_rate: 0.994, season_window: "Normal" },
    { target_date: "2026-04-26", target_orders: 42, actual_orders: 42, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 5, on_time_ship_rate: 0.995, season_window: "Normal" },
    { target_date: "2026-04-27", target_orders: 42, actual_orders: 43, target_assembled: 42, actual_assembled: 43, target_shipped: 42, actual_shipped: 43, backlog_qty: 5, on_time_ship_rate: 0.996, season_window: "Normal" },
  ],
  weekly_operations: [
    { week_start: "2026-04-06", week_end: "2026-04-12", target_orders: 294, actual_orders: 292, target_assembled: 294, actual_assembled: 301, target_shipped: 294, actual_shipped: 299, ending_backlog: 12, on_time_ship_rate: 0.988 },
    { week_start: "2026-04-13", week_end: "2026-04-19", target_orders: 294, actual_orders: 295, target_assembled: 294, actual_assembled: 302, target_shipped: 294, actual_shipped: 298, ending_backlog: 8, on_time_ship_rate: 0.991 },
    { week_start: "2026-04-20", week_end: "2026-04-26", target_orders: 294, actual_orders: 293, target_assembled: 294, actual_assembled: 300, target_shipped: 294, actual_shipped: 297, ending_backlog: 5, on_time_ship_rate: 0.993 },
  ],
  orders_summary: {
    on_time_48h_rate: 0.991,
    on_time_ship_target: 0.98,
    ship_within_hours: 48,
    total_orders: 18240,
    shipped_orders: 17680,
    latest_backlog: 5,
  },
  quality: {
    pareto: [
      { label: "Late Shipment", count: 142 },
      { label: "Wrong Assembly", count: 128 },
      { label: "Cosmetic Defect", count: 96 },
      { label: "Packaging Error", count: 88 },
      { label: "Damaged Return", count: 76 },
      { label: "Missing Component", count: 72 },
      { label: "Hair Detachment", count: 64 },
      { label: "Torso Seam Defect", count: 58 },
      { label: "Paint Run / Overspray", count: 52 },
      { label: "Open Stitch / Seam", count: 46 },
      { label: "Magnet Alignment", count: 42 },
      { label: "Joint Play / Loose Fit", count: 38 },
      { label: "Adhesive Bleed", count: 34 },
      { label: "Label / SKU Mismatch", count: 28 },
    ],
    root_causes: [
      { label: "Unclear Work Instruction", count: 118 },
      { label: "Training Gap", count: 96 },
      { label: "Wrong Part in Bin", count: 88 },
      { label: "Supplier Variation", count: 82 },
      { label: "Rush / Capacity Overload", count: 74 },
      { label: "Shipping Damage", count: 68 },
      { label: "Tool or Jig Issue", count: 62 },
      { label: "Material Batch Variation", count: 54 },
      { label: "Fixture Wear / Wear-in Drift", count: 48 },
      { label: "Environmental Control Gap", count: 42 },
      { label: "System or Data Error", count: 36 },
      { label: "Supplier Defect", count: 32 },
      { label: "Tool or Jig Misalignment", count: 28 },
    ],
    dpmo: 3180,
    dpmo_target: 3400,
    process_yield: 0.947,
    rty_target: 0.95,
    configuration_accuracy: 0.982,
    configuration_accuracy_target: 0.99,
    cpk: 1.21,
    cpk_target: 1.33,
    total_defect_units: 964,
    copq_total_90d: 28450,
    copq_breakdown: {
      quality_cost_lines: { scrap: 1200, rework: 3400, return_cost: 800, warranty: 450, expedite: 600 },
      quality_costs_recorded: 6450,
      returns_and_rework_charges: 22000,
      combined_90d: 28450,
    },
    capa_summary: { by_status: { open: 1, in_progress: 1, closed: 0 }, open: 1, in_progress: 1, closed: 0, total: 2 },
    defect_monthly_trend: [
      { year_month: "2025-11", defect_units: 42 },
      { year_month: "2025-12", defect_units: 38 },
      { year_month: "2026-01", defect_units: 45 },
      { year_month: "2026-02", defect_units: 33 },
      { year_month: "2026-03", defect_units: 51 },
      { year_month: "2026-04", defect_units: 28 },
    ],
    dpmo_basis: {
      order_count: 18240,
      shipped_count: 17680,
      recent_throughput_units: 588,
      units_for_dpmo: 18240,
      defect_units: 964,
      opportunities_per_unit: 12,
    },
    defect_types: [
      { id: 1, defect_code: "wrong_assembly", defect_name: "Wrong Assembly" },
      { id: 2, defect_code: "damaged_return", defect_name: "Damaged Return" },
      { id: 3, defect_code: "missing_component", defect_name: "Missing Component" },
      { id: 4, defect_code: "paint_run", defect_name: "Paint Run / Overspray" },
      { id: 5, defect_code: "label_mismatch", defect_name: "Label / SKU Mismatch" },
    ],
  },
  capa: [
    { capa_number: "CAPA-DEMO-1", title: "Late Shipment — unclear work instruction", status: "open", opened_date: "2026-04-01", due_date: "2026-04-20", effectiveness_verified: false },
    { capa_number: "CAPA-DEMO-2", title: "Wrong Assembly — training gap", status: "in_progress", opened_date: "2026-03-15", due_date: "2026-04-30", effectiveness_verified: false },
  ],
  purpose: {
    orders: "Track daily and weekly performance: orders received, assembled, shipped, 48-hour ship goal, backlog, and whether operations are keeping up.",
    quality:
      "Monitor and improve product quality. Tracks defects (wrong assembly, damage, and other codes), calculates metrics like DPMO and yield, shows root causes, manages CAPA (corrective actions), and tracks cost of poor quality. Helps reduce mistakes and improve consistency.",
    settings: "Fine-tune forecasting parameters, safety stock, ship and quality targets, and other thresholds — values here drive the Orders and Quality views.",
  },
};

const OperationalContext = createContext(null);

function mergeForecastParameterMaps(base, overrides) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(overrides || {})) {
    if (v === "" || v === null || v === undefined) continue;
    const num = Number(v);
    out[k] = Number.isFinite(num) && String(v).trim() !== "" ? num : v;
  }
  return out;
}

function OperationalDataProvider({ children }) {
  const [operational, setOperational] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");
  const [overrideVersion, setOverrideVersion] = useState(0);

  const parameterOverrides = useMemo(() => loadRawParameterOverrides(), [overrideVersion]);

  const reloadOperational = useCallback(() => {
    setLoading(true);
    getOperationalWorkbench()
      .then((data) => {
        setOperational(data);
        setSource("live");
      })
      .catch(() => {
        setOperational(MOCK_OPERATIONAL);
        setSource("mock");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reloadOperational();
  }, [reloadOperational]);

  const mergedParameterMap = useMemo(
    () => mergeForecastParameterMaps(operational?.forecast_parameter_map ?? {}, parameterOverrides),
    [operational, parameterOverrides]
  );

  const saveParameterOverrides = useCallback((patch) => {
    const next = { ...loadRawParameterOverrides(), ...patch };
    localStorage.setItem(SETTINGS_PARAM_OVERRIDES_KEY, JSON.stringify(next));
    setOverrideVersion((v) => v + 1);
  }, []);

  const clearParameterOverrides = useCallback(() => {
    localStorage.removeItem(SETTINGS_PARAM_OVERRIDES_KEY);
    setOverrideVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      operational,
      operationalLoading: loading,
      operationalSource: source,
      reloadOperational,
      mergedParameterMap,
      parameterOverrides,
      saveParameterOverrides,
      clearParameterOverrides,
    }),
    [operational, loading, source, reloadOperational, mergedParameterMap, parameterOverrides, saveParameterOverrides, clearParameterOverrides]
  );

  return <OperationalContext.Provider value={value}>{children}</OperationalContext.Provider>;
}

/** Traffic-light rollup for the mission-control header (ops + quality + backlog trajectory). */
function computeExecutiveRiskBand({ rate, shipTarget, dpmo, dpmoTarget, backlogSeries }) {
  const r = Number(rate);
  const st = Number(shipTarget);
  const shipGap = Number.isFinite(r) && Number.isFinite(st) ? st - r : 0;
  const dt = Number(dpmoTarget);
  const dpmoT = Number.isFinite(dt) && dt > 0 ? dt : 3400;
  const dRaw = Number(dpmo);
  const d = Number.isFinite(dRaw) ? dRaw : 0;
  const ratio = dpmoT > 0 ? d / dpmoT : 1;
  let backlogRising = false;
  if (Array.isArray(backlogSeries) && backlogSeries.length >= 2) {
    const b0 = Number(backlogSeries[backlogSeries.length - 2]) || 0;
    const b1 = Number(backlogSeries[backlogSeries.length - 1]) || 0;
    backlogRising = b1 > b0 + Math.max(1, b0 * 0.08);
  }
  if (shipGap > 0.03 || ratio > 1.22) return "red";
  if (shipGap > 0.008 || ratio > 1.05 || backlogRising) return "yellow";
  return "green";
}

function buildMissionControlAlerts({
  quality,
  shipTarget,
  rate,
  shipHours,
  daily,
  mergedParameterMap,
  forecastData,
  forecastStatus,
  confTarget,
  dpmoTarget,
}) {
  const alerts = [];
  const dpmoT = Number(dpmoTarget) || 3400;
  const dpmoRaw = Number(quality?.dpmo ?? 0);
  const dpmoVal = Number.isFinite(dpmoRaw) ? dpmoRaw : 0;
  const shipRate = Number(rate);
  const shipTargetN = Number(shipTarget);
  const shipOk = Number.isFinite(shipRate) && Number.isFinite(shipTargetN);
  const capaSum = quality?.capa_summary ?? {};
  const capaOpen = Number(capaSum.open ?? 0) + Number(capaSum.in_progress ?? 0);
  const confT = Number(confTarget) || 0.99;
  const confAcc = Number(quality?.configuration_accuracy ?? 0);

  if (shipOk && shipRate < shipTargetN - 0.02) {
    alerts.push({
      pri: 0,
      severity: "error",
      title: "Shipping performance at risk",
      detail: `${shipHours}-hour on-time rate is ${(shipRate * 100).toFixed(1)}% vs ${(shipTargetN * 100).toFixed(0)}% target. Review capacity, backlog, and partner handoffs.`,
      to: "/orders",
      linkLabel: "Orders & targets",
    });
  } else if (shipOk && shipRate < shipTargetN - 0.001) {
    alerts.push({
      pri: 1,
      severity: "warning",
      title: "Slightly below ship target",
      detail: `${shipHours}-hour on-time rate ${(shipRate * 100).toFixed(1)}% vs ${(shipTargetN * 100).toFixed(0)}% target.`,
      to: "/orders",
      linkLabel: "Orders & targets",
    });
  }

  const last = daily.length ? daily[daily.length - 1] : null;
  if (last && Number(last.target_shipped) > 0 && Number(last.actual_shipped ?? 0) < Number(last.target_shipped)) {
    alerts.push({
      pri: 1,
      severity: "warning",
      title: "Latest day under ship plan",
      detail: `Shipped ${last.actual_shipped ?? 0} vs target ${last.target_shipped} (${last.target_date}).`,
      to: "/orders",
      linkLabel: "Orders & targets",
    });
  }

  if (daily.length >= 2) {
    const b0 = Number(daily[daily.length - 2].backlog_qty) || 0;
    const b1 = Number(daily[daily.length - 1].backlog_qty) || 0;
    if (b1 > b0 + Math.max(1, b0 * 0.05)) {
      alerts.push({
        pri: 2,
        severity: "warning",
        title: "Backlog trending up",
        detail: `End-of-day backlog ${b1} vs ${b0} on the prior day.`,
        to: "/orders",
        linkLabel: "Orders & targets",
      });
    }
  }

  if (dpmoVal > dpmoT * 1.18) {
    alerts.push({
      pri: 0,
      severity: "error",
      title: "DPMO well above target",
      detail: `Estimated DPMO ${Math.round(dpmoVal).toLocaleString()} vs target ${Math.round(dpmoT).toLocaleString()}.`,
      to: "/quality",
      linkLabel: "Quality",
    });
  } else if (dpmoVal > dpmoT) {
    alerts.push({
      pri: 2,
      severity: "warning",
      title: "DPMO above target",
      detail: `Estimated DPMO ${Math.round(dpmoVal).toLocaleString()} vs target ${Math.round(dpmoT).toLocaleString()}.`,
      to: "/quality",
      linkLabel: "Quality",
    });
  }

  if (confAcc > 0 && confAcc < confT - 0.015) {
    alerts.push({
      pri: 3,
      severity: "warning",
      title: "Configuration accuracy below goal",
      detail: `${(confAcc * 100).toFixed(1)}% vs ${(confT * 100).toFixed(0)}% target — check build instructions and kitting.`,
      to: "/quality",
      linkLabel: "Quality",
    });
  }

  if (capaOpen > 0) {
    alerts.push({
      pri: 4,
      severity: "info",
      title: `${capaOpen} active CAPA case${capaOpen === 1 ? "" : "s"}`,
      detail: "Corrective actions need ownership and follow-up until closed.",
      to: "/quality",
      linkLabel: "Quality",
    });
  }

  const top = quality?.pareto?.[0];
  if (top && Number(top.count) >= 8) {
    alerts.push({
      pri: 5,
      severity: "info",
      title: `Leading defect driver: ${top.label}`,
      detail: `${top.count} units in the current Pareto view — prioritize containment.`,
      to: "/quality",
      linkLabel: "Quality",
    });
  }

  const plan = forecastData?.parts_plan;
  if (Array.isArray(plan) && plan.length) {
    const hot = [...plan]
      .filter((p) => Number(p.recommended_order_qty) > 0)
      .sort((a, b) => Number(b.recommended_order_qty) - Number(a.recommended_order_qty))[0];
    if (hot) {
      alerts.push({
        pri: 3,
        severity: "warning",
        title: `Parts gap: ${hot.part_name ?? hot.part_number}`,
        detail: `Recommended buy ${Number(hot.recommended_order_qty).toLocaleString()} units (forecast vs available + safety).`,
        to: "/forecasting",
        linkLabel: "Forecasting",
      });
    }
  }

  if (forecastStatus === "empty") {
    alerts.push({
      pri: 6,
      severity: "info",
      title: "Demand forecast needs history",
      detail: "Import doll sales history to unlock forward-looking demand and BOM buy recommendations.",
      to: "/upload",
      linkLabel: "Upload data",
    });
  } else if (forecastStatus === "mock") {
    alerts.push({
      pri: 7,
      severity: "info",
      title: "Forecast workbench offline",
      detail: "Start the API and seed sales/parameters to see 12-month demand on this dashboard.",
      to: "/forecasting",
      linkLabel: "Forecasting",
    });
  }

  const promoM = mergedParameterMap?.mega_promo_multiplier;
  if (promoM != null && Number(promoM) >= 2.5 && forecastData?.forecast?.length) {
    const peak = [...forecastData.forecast].sort((a, b) => Number(b.doll_units_forecast) - Number(a.doll_units_forecast))[0];
    if (peak?.year_month) {
      alerts.push({
        pri: 8,
        severity: "info",
        title: `Demand peak: ${peak.year_month}`,
        detail: `Plan materials and capacity around ~${Number(peak.doll_units_forecast).toLocaleString()} doll units in that month.`,
        to: "/forecasting",
        linkLabel: "Forecasting",
      });
    }
  }

  alerts.sort((a, b) => a.pri - b.pri);
  return alerts.slice(0, 12);
}

function useOperationalWorkbench() {
  const ctx = useContext(OperationalContext);
  if (!ctx) {
    throw new Error("useOperationalWorkbench must be used within OperationalDataProvider");
  }
  return ctx;
}

const PRODUCTION_TEAM_LABELS = ["Production Team 1", "Production Team 2", "Production Team 3", "Production Team 4"];
const PRODUCTION_SHIFTS = [
  { key: "day", label: "Day Shift" },
  { key: "night", label: "Night Shift" },
];

/** Integer doll counts per team × shift; sum equals totalDolls; max(cell) − min(non-empty) ≤ 1 when total > 0. */
function buildEvenTeamShiftPlan(totalDolls) {
  const total = Math.max(0, Math.round(Number(totalDolls) || 0));
  const nTeams = PRODUCTION_TEAM_LABELS.length;
  const nShifts = PRODUCTION_SHIFTS.length;
  const slots = nTeams * nShifts;
  const base = slots ? Math.floor(total / slots) : 0;
  const remainder = slots ? total % slots : 0;
  const rows = PRODUCTION_TEAM_LABELS.map((teamLabel, teamIdx) => {
    const cells = PRODUCTION_SHIFTS.map((shift, shiftIdx) => {
      const slotIndex = teamIdx * nShifts + shiftIdx;
      const qty = base + (slotIndex < remainder ? 1 : 0);
      return { shiftKey: shift.key, shiftLabel: shift.label, qty };
    });
    const rowSum = cells.reduce((s, c) => s + c.qty, 0);
    return { teamLabel, cells, rowSum };
  });
  const shiftColumnTotals = PRODUCTION_SHIFTS.map((shift, shiftIdx) =>
    rows.reduce((s, r) => s + r.cells[shiftIdx].qty, 0)
  );
  return { total, slots, base, remainder, rows, shiftColumnTotals };
}

/** Same-day wall-clock milestones (workday 8:00 AM–5:00 PM). */
const FULFILLMENT_CHECKPOINTS = [
  { label: "10:00 AM", hour: 10, minute: 0 },
  { label: "12:00 Noon", hour: 12, minute: 0 },
  { label: "3:00 PM", hour: 15, minute: 0 },
  { label: "5:00 PM", hour: 17, minute: 0 },
];

const WORKDAY_START_MIN = 8 * 60;
const WORKDAY_END_MIN = 17 * 60;
/** Share of the workday: boxing trails assembly; dispatch to partner trails boxing. */
const PIPELINE_LAG_BOXED = 0.07;
const PIPELINE_LAG_DISPATCH = 0.14;

function fractionThroughWorkday(hour, minute) {
  const t = hour * 60 + minute;
  if (t <= WORKDAY_START_MIN) return 0;
  if (t >= WORKDAY_END_MIN) return 1;
  return (t - WORKDAY_START_MIN) / (WORKDAY_END_MIN - WORKDAY_START_MIN);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** Cumulative doll counts by checkpoint: completed (assembly), boxed, dispatched to shipping partner. */
function buildFulfillmentCheckpointRows(totalDolls) {
  const total = Math.max(0, Math.round(Number(totalDolls) || 0));
  if (!total) return [];

  return FULFILLMENT_CHECKPOINTS.map((cp) => {
    const frac = fractionThroughWorkday(cp.hour, cp.minute);
    const completed = Math.round(total * frac);
    const boxedProgress = clamp01((frac - PIPELINE_LAG_BOXED) / (1 - PIPELINE_LAG_BOXED));
    const boxed = Math.round(total * boxedProgress);
    const dispatchProgress = clamp01((frac - PIPELINE_LAG_DISPATCH) / (1 - PIPELINE_LAG_DISPATCH));
    const dispatched = Math.round(total * dispatchProgress);
    return {
      timeLabel: cp.label,
      completed,
      boxed,
      dispatched,
      dayProgressPct: Math.round(frac * 100),
    };
  });
}

function App() {
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobileDrawer = () => setMobileOpen((prev) => !prev);
  const closeMobileDrawer = () => setMobileOpen(false);

  const navigation = (
    <List>
      {navItems.map(([label, path]) => (
        <ListItemButton
          component={NavLink}
          to={path}
          end={path === "/"}
          key={label}
          onClick={closeMobileDrawer}
          sx={{
            mx: 1.5,
            my: 0.5,
            borderRadius: 2,
            color: NAV_LABEL,
            "&:hover": {
              backgroundColor: NAV_HOVER_BG,
              color: "#FFFFFF",
            },
            "&.active": {
              backgroundColor: NAV_ACTIVE_BG,
              color: "#FFFFFF",
              boxShadow: "inset 3px 0 0 rgba(237, 231, 255, 0.65)",
              "&:hover": {
                backgroundColor: NAV_ACTIVE_BG_HOVER,
                color: "#FFFFFF",
              },
            },
          }}
        >
          <ListItemText
            primary={label}
            slotProps={{
              primary: {
                fontWeight: 700,
                fontSize: 14,
                sx: { color: "inherit" },
              },
            }}
          />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <BrowserRouter>
      <OperationalDataProvider>
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default", overflowX: "hidden" }}>
          <AppBar position="fixed" color="transparent" elevation={0} sx={{ zIndex: 1201 }}>
            <Toolbar
              sx={{
                minHeight: 72,
                px: { xs: 1.5, sm: 3 },
                color: "#fff",
              }}
            >
              {isMobile ? (
                <IconButton edge="start" onClick={toggleMobileDrawer} sx={{ mr: 1, color: "inherit" }} aria-label="Open navigation menu">
                  <MenuIcon />
                </IconButton>
              ) : null}
              <Box
                component={Link}
                to="/"
                aria-label="OptiDoll — Home"
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "12px",
                  flexShrink: 0,
                  mr: 2,
                  overflow: "hidden",
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  boxShadow: "0 4px 18px rgba(0, 0, 0, 0.2)",
                  backgroundImage: appBarBackgroundImage,
                  backgroundSize: "100vw 100%",
                  backgroundAttachment: "fixed",
                  backgroundPosition: "0 0",
                  backgroundRepeat: "no-repeat",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
                  component="svg"
                  viewBox="0 0 32 32"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                  sx={{ width: 26, height: 26, display: "block" }}
                >
                  <circle cx="16" cy="16" r="10.25" fill="none" stroke="#B89758" strokeWidth="1.15" strokeOpacity="0.92" />
                  <circle cx="16" cy="16" r="5.75" fill="none" stroke="#B89758" strokeWidth="0.85" strokeOpacity="0.42" />
                  <circle cx="16" cy="9.5" r="1.15" fill={PANTONE_178} fillOpacity="0.92" />
                </Box>
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0, mr: { xs: 1, sm: 2 } }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    columnGap: 0.5,
                    lineHeight: 1.1,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontFamily: '"Dancing Script", "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive',
                      fontWeight: 500,
                      fontSize: { xs: "1.85rem", sm: "2.15rem", md: "2.35rem" },
                      letterSpacing: "0.03em",
                      color: "rgba(255, 255, 255, 0.96)",
                      mr: { xs: -0.75, sm: -1 },
                      position: "relative",
                      zIndex: 1,
                      transform: "translateY(2px)",
                    }}
                  >
                    Opti
                  </Box>
                  <Typography
                    component="span"
                    variant="h6"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: "0.01em",
                      color: PANTONE_178,
                      position: "relative",
                      zIndex: 0,
                      fontSize: { xs: "1.1rem", sm: "1.2rem", md: "1.25rem" },
                    }}
                  >
                    Doll
                  </Typography>
                  <Typography
                    component="span"
                    variant="h6"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: "0.01em",
                      color: "inherit",
                      fontSize: { xs: "1.1rem", sm: "1.2rem", md: "1.25rem" },
                      ml: { xs: 0.25, sm: 0.5 },
                    }}
                  >
                    Sigma Supply Chain Platform
                  </Typography>
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.86,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: { xs: "none", md: "block" },
                  }}
                >
                  Precision Forecasting • Curated Assembly • Exquisite Dolls
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Tooltip title="Upload operational files" arrow {...TOOLTIP_DELAY_PROPS}>
                  <Button
                    color="inherit"
                    startIcon={<UploadFileIcon />}
                    component={Link}
                    to="/upload"
                    sx={{ display: { xs: "none", sm: "inline-flex" } }}
                  >
                    Upload Data
                  </Button>
                </Tooltip>
                <Tooltip title="Open forecasting workbench" arrow {...TOOLTIP_DELAY_PROPS}>
                  <Button
                    color="inherit"
                    startIcon={<PlayArrowIcon />}
                    component={Link}
                    to="/forecasting"
                    sx={{ display: { xs: "none", sm: "inline-flex" } }}
                    aria-label="Run demand forecasting"
                  >
                    Run Forecast
                  </Button>
                </Tooltip>
              </Stack>
            </Toolbar>
          </AppBar>

          {isMobile ? (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={closeMobileDrawer}
              ModalProps={{ keepMounted: true }}
              sx={{
                [`& .MuiDrawer-paper`]: {
                  width: drawerWidth,
                  boxSizing: "border-box",
                  pt: 9,
                  px: 1.5,
                },
              }}
            >
              {navigation}
            </Drawer>
          ) : (
            <Drawer
              variant="permanent"
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: {
                  width: drawerWidth,
                  boxSizing: "border-box",
                  pt: 9,
                  px: 1.5,
                  borderRight: "1px solid rgba(255, 255, 255, 0.12)",
                },
              }}
            >
              {navigation}
            </Drawer>
          )}

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              mt: 8,
              px: { xs: 2, sm: 3 },
              pt: { xs: 2, sm: 3 },
              pb: { xs: 4, sm: 5 },
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<UploadData />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/forecasting" element={<Forecasting />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/quality" element={<Quality />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>

            <Box
              sx={{
                mt: 5,
                pt: 2,
                borderTop: "1px solid #D6E2E8",
                color: "text.secondary",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Powered by DelphinQ Intelligence
            </Box>
          </Box>
        </Box>
      </OperationalDataProvider>
    </BrowserRouter>
  );
}

function Dashboard() {
  const { operational, operationalLoading, operationalSource, mergedParameterMap } = useOperationalWorkbench();
  const [dsSummary, setDsSummary] = useState(mockSummary);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [forecastData, setForecastData] = useState(null);
  const [forecastStatus, setForecastStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    getDashboardSummary()
      .then((data) => {
        if (!cancelled) {
          setDsSummary(data);
          setBackendStatus("connected");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDsSummary(mockSummary);
          setBackendStatus("mock");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDemandForecastWorkbench()
      .then((data) => {
        if (cancelled) return;
        setForecastData(data);
        if (data?.error === "no_history") setForecastStatus("empty");
        else setForecastStatus("live");
      })
      .catch(() => {
        if (!cancelled) {
          setForecastData(null);
          setForecastStatus("mock");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const base = operational ?? MOCK_OPERATIONAL;
  const hasLiveDaily = (operational?.daily_operations?.length ?? 0) > 0;
  const daily = hasLiveDaily ? operational.daily_operations.slice(-14) : MOCK_OPERATIONAL.daily_operations;
  const orders = base.orders_summary ?? MOCK_OPERATIONAL.orders_summary;
  const quality = base.quality ?? MOCK_OPERATIONAL.quality;

  const shipHours = Number(mergedParameterMap.ship_within_hours ?? orders.ship_within_hours ?? 48);
  const shipTarget = Number(mergedParameterMap.on_time_ship_target ?? orders.on_time_ship_target ?? 0.98);
  const rate = Number(orders.on_time_48h_rate ?? dsSummary.on_time_48h_rate ?? 0);
  const dpmoTarget = Number(mergedParameterMap.dpmo_target ?? quality.dpmo_target ?? 3400);
  const confTarget = Number(mergedParameterMap.configuration_accuracy_target ?? quality.configuration_accuracy_target ?? 0.99);
  const rawDpmo = Number(quality.dpmo ?? dsSummary.estimated_dpmo);
  const dpmoVal = Number.isFinite(rawDpmo) ? rawDpmo : 0;
  const dpmoBasis = quality.dpmo_basis;
  const defectUnits = Number(quality.total_defect_units ?? dsSummary.total_defects ?? 0);
  const capaOpen = Number(quality.capa_summary?.open ?? 0) + Number(quality.capa_summary?.in_progress ?? 0);
  const totalOrders = Number(orders.total_orders ?? dsSummary.total_orders ?? 0);
  const shippedOrders = Number(orders.shipped_orders ?? dsSummary.shipped_orders ?? 0);
  const latestBacklog = orders.latest_backlog ?? "—";

  const dailyLabels = useMemo(() => daily.map((d) => d.target_date?.slice(5) ?? ""), [daily]);
  const shipActual = useMemo(() => daily.map((d) => d.actual_shipped ?? 0), [daily]);
  const backlogSeries = useMemo(() => daily.map((d) => d.backlog_qty ?? 0), [daily]);

  const fcLabels = useMemo(() => (forecastData?.forecast ?? []).map((f) => f.year_month?.slice(2) ?? ""), [forecastData]);
  const fcValues = useMemo(() => (forecastData?.forecast ?? []).map((f) => f.doll_units_forecast ?? 0), [forecastData]);
  const nextMoDemand = forecastData?.forecast?.[0]?.doll_units_forecast;

  const riskBand = useMemo(
    () => computeExecutiveRiskBand({ rate, shipTarget, dpmo: dpmoVal, dpmoTarget, backlogSeries }),
    [rate, shipTarget, dpmoVal, dpmoTarget, backlogSeries]
  );

  const alerts = useMemo(
    () =>
      buildMissionControlAlerts({
        quality,
        shipTarget,
        rate,
        shipHours,
        daily,
        mergedParameterMap,
        forecastData,
        forecastStatus,
        confTarget,
        dpmoTarget,
      }),
    [quality, shipTarget, rate, shipHours, daily, mergedParameterMap, forecastData, forecastStatus, confTarget, dpmoTarget]
  );

  const rateF = Number(rate);
  const shipTargetF = Number(shipTarget);
  const shipKpiColor =
    !Number.isFinite(rateF) || !Number.isFinite(shipTargetF)
      ? "primary"
      : rateF >= shipTargetF - 0.005
        ? "success"
        : rateF >= shipTargetF - 0.03
          ? "warning"
          : "error";
  const dpmoTargetF = Number(dpmoTarget);
  const dpmoKpiColor =
    !Number.isFinite(dpmoTargetF) || dpmoTargetF <= 0
      ? "warning"
      : dpmoVal <= dpmoTargetF
        ? "success"
        : dpmoVal <= dpmoTargetF * 1.12
          ? "warning"
          : "error";
  const accuracy = `${((quality.configuration_accuracy ?? dsSummary.configuration_accuracy) * 100).toFixed(1)}%`;
  const defectMonthly = quality.defect_monthly_trend;
  const defectTrendLabels = useMemo(
    () => (defectMonthly ?? []).map((t) => String(t.year_month ?? "").slice(2)),
    [defectMonthly]
  );
  const defectTrendValues = useMemo(() => (defectMonthly ?? []).map((t) => t.defect_units ?? 0), [defectMonthly]);

  return (
    <Page
      title="Executive Overview"
      subtitle="Mission control: one place to see orders, shipping, quality, demand, and what deserves attention right now."
    >
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        {backendStatus === "checking" || operationalLoading ? <CircularProgress size={18} /> : null}
        <Chip
          size="small"
          variant="outlined"
          color={backendStatus === "connected" ? "success" : "warning"}
          label={`Summary API: ${backendStatus === "checking" ? "…" : backendStatus === "connected" ? "live" : "demo"}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={operationalSource === "live" ? "success" : "warning"}
          label={`Operations: ${operationalLoading ? "…" : operationalSource === "live" ? "live" : "demo"}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={forecastStatus === "live" ? "success" : forecastStatus === "empty" ? "default" : "warning"}
          label={`Forecast: ${forecastStatus === "checking" ? "…" : forecastStatus === "live" ? "live" : forecastStatus === "empty" ? "no history" : "offline"}`}
        />
      </Stack>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Executive pulse"
            value={riskBand.toUpperCase()}
            subtitle="Ship goal vs actual, DPMO vs Settings target, backlog trend"
            color={riskToColor(riskBand)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title={`${shipHours}-hour ship rate`}
            value={Number.isFinite(Number(rate)) ? `${(Number(rate) * 100).toFixed(1)}%` : "—"}
            subtitle={`Target ${(Number(shipTarget) * 100).toFixed(0)}% (Settings)`}
            color={shipKpiColor}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Latest backlog" value={latestBacklog} subtitle="End of last reported ops day" color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Orders in system"
            value={totalOrders.toLocaleString()}
            subtitle={`Shipped: ${shippedOrders.toLocaleString()}`}
            color="primary"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Estimated DPMO"
            value={Math.round(dpmoVal).toLocaleString()}
            subtitle={
              dpmoBasis?.units_for_dpmo != null
                ? `Target ≤ ${Math.round(Number(dpmoTarget) || 0).toLocaleString()} · ${Number(dpmoBasis.units_for_dpmo).toLocaleString()} doll-unit basis × ${dpmoBasis.opportunities_per_unit ?? 12} opp`
                : `Target ≤ ${Math.round(Number(dpmoTarget) || 0).toLocaleString()}`
            }
            color={dpmoKpiColor}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Defect units (logged)" value={defectUnits.toLocaleString()} subtitle="Total quantity across defect events" color="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Active CAPAs" value={capaOpen.toLocaleString()} subtitle="Open + in progress" color={capaOpen > 0 ? "warning" : "success"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Next month demand (forecast)"
            value={nextMoDemand != null ? Number(nextMoDemand).toLocaleString() : "—"}
            subtitle={forecastData?.horizon_doll_units_total != null ? `12-mo horizon: ${Number(forecastData.horizon_doll_units_total).toLocaleString()} dolls` : "From forecasting workbench"}
            color="secondary"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Configuration accuracy"
            value={accuracy}
            subtitle={`Target ${(confTarget * 100).toFixed(0)}%`}
            color={Number(quality.configuration_accuracy ?? dsSummary.configuration_accuracy) >= confTarget - 0.01 ? "success" : "warning"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Inventory SKUs tracked"
            value={Number(dsSummary.inventory_records ?? 0).toLocaleString()}
            subtitle={`Suppliers: ${Number(dsSummary.supplier_count ?? 0)} · Buy recs: ${Number(dsSummary.recommendation_count ?? 0)}`}
            color="primary"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <CardBox title="Demand forecast — next 12 months (doll units)">
            {forecastStatus === "checking" ? (
              <Skeleton variant="rounded" height={220} />
            ) : forecastStatus === "empty" ? (
              <Alert severity="info">No sales history yet. Upload doll demand data to populate this trend.</Alert>
            ) : fcValues.length ? (
              <>
                <MiniLineChart
                  labels={fcLabels}
                  values={fcValues}
                  color={primaryMain}
                  yLabel="Doll units"
                  yValueUnit=" dolls"
                  chipLabel="Forecast / month"
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Peaks reflect seasonality and promo multipliers from Settings. Detail:{" "}
                  <Button component={Link} to="/forecasting" size="small" sx={{ verticalAlign: "baseline", p: 0, minWidth: 0 }}>
                    Forecasting workbench
                  </Button>
                  .
                </Typography>
              </>
            ) : (
              <Alert severity="warning">Forecast workbench unavailable. Start the API to load forward demand.</Alert>
            )}
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <CardBox title="Needs attention now">
            {alerts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No critical signals in the current snapshot — keep monitoring ship rate, backlog, and quality on the pages below.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {alerts.map((a) => (
                  <Alert
                    key={`${a.pri}-${a.title}`}
                    severity={a.severity}
                    variant="outlined"
                    action={
                      a.to ? (
                        <Button component={Link} to={a.to} size="small" color="inherit">
                          {a.linkLabel ?? "Open"}
                        </Button>
                      ) : null
                    }
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {a.title}
                    </Typography>
                    {a.detail ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {a.detail}
                      </Typography>
                    ) : null}
                  </Alert>
                ))}
              </Stack>
            )}
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Fulfillment — shipped vs plan (last 14 days)">
            <MiniLineChart
              labels={dailyLabels.length ? dailyLabels : ["—"]}
              values={shipActual.length ? shipActual : [0]}
              color="#2563eb"
              yLabel="Units"
              yValueUnit=" shipped"
              chipLabel="Actual shipped / day"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Compare to plan:{" "}
              <Button component={Link} to="/orders" size="small" sx={{ verticalAlign: "baseline", p: 0, minWidth: 0 }}>
                Orders & targets
              </Button>{" "}
              for targets, backlog, and production plan.
            </Typography>
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Backlog trend (end of day)">
            <MiniLineChart
              labels={dailyLabels.length ? dailyLabels : ["—"]}
              values={backlogSeries.length ? backlogSeries : [0]}
              color="#b45309"
              yLabel="Backlog"
              yValueUnit=" units"
              chipLabel="Backlog EOD"
            />
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <CardBox title="Quality — defect units by month">
            {defectTrendValues.length ? (
              <MiniLineChart
                labels={defectTrendLabels}
                values={defectTrendValues}
                color="#cb333b"
                yLabel="Defect units"
                yValueUnit=" units"
                chipLabel="Logged defects / month"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No monthly defect trend yet. Log defects on the Quality page or import seed data.
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              <Button component={Link} to="/quality" size="small" sx={{ verticalAlign: "baseline", p: 0, minWidth: 0 }}>
                Quality / Six Sigma
              </Button>{" "}
              for Pareto, CAPA, and COPQ.
            </Typography>
          </CardBox>
        </Grid>
      </Grid>
    </Page>
  );
}

function downloadTemplate(path) {
  const url = `${API_BASE}/uploads/${path}/`;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
}

function downloadMediaFile(filename) {
  const base = API_BASE.replace("/api", "");
  const a = document.createElement("a");
  a.href = `${base}/media/uploads/${filename}`;
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
}

function stripUtf8Bom(text) {
  return String(text ?? "").replace(/^\uFEFF/, "");
}

/** Split one CSV line; respects quoted fields and doubled quotes. */
function splitCsvLine(line) {
  const s = String(line);
  const fields = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (inQ && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === "," && !inQ) {
      fields.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  fields.push(cur.trim());
  return fields;
}

const REQUIRED_CSV_HEADERS = ["part_number", "part_name", "available_qty", "reorder_point_qty"];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DAILY_PLAN_UNIT_CHK_CAP = 24;

/**
 * Full HTML document for the daily production & fulfillment plan (print or PDF).
 */
function buildDailyPlanFullHtml(opts) {
  const {
    planDateLabel,
    planTotalDolls,
    planBacklogQty,
    planNewOrdersQty,
    productionPlan,
    fulfillmentCheckpoints,
    shipHours,
  } = opts;

  const teamRows = (productionPlan?.rows ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.teamLabel)}</td>${r.cells.map((c) => `<td style="text-align:center">${c.qty}</td>`).join("")}<td style="text-align:right">${r.rowSum}</td></tr>`
    )
    .join("");

  let prevC = 0;
  let prevB = 0;
  let prevD = 0;
  let timelineBody = "";
  for (const row of fulfillmentCheckpoints) {
    const incC = Math.max(0, row.completed - prevC);
    const incB = Math.max(0, row.boxed - prevB);
    const incD = Math.max(0, row.dispatched - prevD);
    prevC = row.completed;
    prevB = row.boxed;
    prevD = row.dispatched;

    const unitBoxes = (n, kind) => {
      const cap = Math.min(Math.max(0, n), DAILY_PLAN_UNIT_CHK_CAP);
      let h = '<div class="unit-grid">';
      for (let i = 1; i <= cap; i++) {
        h += `<label class="unit-chk"><input type="checkbox" /> <span>${escapeHtml(kind)} ${i}</span></label>`;
      }
      if (n > DAILY_PLAN_UNIT_CHK_CAP) {
        h += `<p class="unit-more">+ ${n - DAILY_PLAN_UNIT_CHK_CAP} additional ${escapeHtml(kind)} units — batch sign-off: ☐</p>`;
      }
      if (n === 0) {
        h += '<p class="muted">—</p>';
      }
      h += "</div>";
      return h;
    };

    timelineBody += `<tr class="timeline-head"><td colspan="4"><strong>${escapeHtml(row.timeLabel)}</strong> — cumulative targets: completed ${row.completed}, boxed ${row.boxed}, dispatched ${row.dispatched}</td></tr>`;
    timelineBody += `<tr><td colspan="4" class="sub">Milestone sign-off (entire target through this time)</td></tr>`;
    timelineBody += `<tr><td>Assembly complete</td><td>Target ${row.completed}</td><td>Increment +${incC}</td><td class="chk">☐ Verified</td></tr>`;
    timelineBody += `<tr><td>Boxed</td><td>Target ${row.boxed}</td><td>Increment +${incB}</td><td class="chk">☐ Verified</td></tr>`;
    timelineBody += `<tr><td>Dispatch to shipping partner</td><td>Target ${row.dispatched}</td><td>Increment +${incD}</td><td class="chk">☐ Verified</td></tr>`;
    timelineBody += `<tr><td colspan="4" class="sub">Per-unit / per-order checks for this window (assembly increments)</td></tr>`;
    timelineBody += `<tr><td colspan="4">${unitBoxes(incC, "Completed")}</td></tr>`;
  }

  if (!fulfillmentCheckpoints.length) {
    timelineBody = `<tr><td colspan="4" class="muted">Set backlog and new-order quantities on Orders &amp; Targets to generate timeline targets, then re-export.</td></tr>`;
  }

  const defectRows = Array.from({ length: 8 }, () => '<tr><td></td><td></td><td></td><td class="chk">☐</td></tr>').join("");

  const generatedAt = new Date().toLocaleString();
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Daily Plan — ${escapeHtml(planDateLabel)}</title>
<style>
  body { font-family: system-ui, "Segoe UI", sans-serif; margin: 0; background: #f8fafc; color: #0f172a; font-size: 11pt; }
  .bar { background: linear-gradient(135deg, #2d2640, #5c4d8a); color: #fff; padding: 1rem 1.25rem; }
  .bar h1 { margin: 0; font-size: 1.25rem; font-weight: 800; }
  .meta { font-size: 0.82rem; opacity: 0.95; margin-top: 0.45rem; line-height: 1.5; }
  .sheet { margin: 1rem auto; max-width: 900px; padding: 0 1rem 2rem; }
  h2 { font-size: 1rem; margin: 1.25rem 0 0.5rem; color: #334155; border-bottom: 2px solid #c7d2fe; padding-bottom: 0.25rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.88rem; margin-bottom: 0.75rem; background: #fff; box-shadow: 0 1px 4px rgba(15,23,42,0.06); }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 700; text-align: left; }
  .timeline-head td { background: #eef2ff; font-size: 0.95rem; }
  .sub { background: #fafafa; font-size: 0.8rem; color: #64748b; font-weight: 600; }
  .chk { text-align: center; font-size: 1rem; white-space: nowrap; }
  .unit-grid { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; align-items: center; margin: 0.35rem 0; }
  .unit-chk { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; }
  .unit-more { margin: 0.35rem 0 0; font-size: 0.8rem; color: #64748b; }
  .muted { color: #64748b; font-style: italic; }
  .callout { background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 0.75rem 1rem; margin: 1rem 0; font-size: 0.88rem; }
  .callout strong { color: #9a3412; }
  .toolbar { margin: 1rem 0; }
  button { font: inherit; padding: 0.5rem 1rem; border-radius: 8px; border: none; background: #5c4d8a; color: #fff; cursor: pointer; font-weight: 700; }
  button:hover { filter: brightness(1.05); }
  h2 { page-break-after: avoid; }
  .bar { page-break-after: avoid; }
  @media print {
    body { background: #fff; }
    .toolbar, button { display: none !important; }
    .sheet { max-width: none; padding: 0; }
    table { break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style></head><body>
<div class="bar"><h1>Daily production &amp; fulfillment plan</h1>
<div class="meta"><strong>Plan date:</strong> ${escapeHtml(planDateLabel)} · <strong>Generated:</strong> ${escapeHtml(generatedAt)}<br/>
<strong>Plan total:</strong> ${planTotalDolls.toLocaleString()} dolls (backlog ${planBacklogQty.toLocaleString()} + new orders ${planNewOrdersQty.toLocaleString()}) · <strong>${escapeHtml(String(shipHours))}h</strong> ship program</div></div>
<div class="sheet">
<p class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></p>

<h2>Build allocation — 4 teams × shifts</h2>
<table><thead><tr><th>Team</th><th>Day shift</th><th>Night shift</th><th style="text-align:right">Row total</th></tr></thead><tbody>${teamRows || '<tr><td colspan="4" class="muted">No team breakdown (set plan quantities).</td></tr>'}</tbody></table>

<h2>Timeline — completed, boxed, dispatch (check as verified for the day)</h2>
<table><thead><tr><th>Stage / window</th><th>Cumulative target</th><th>This window Δ</th><th style="text-align:center">Sign-off</th></tr></thead><tbody>${timelineBody}</tbody></table>

<div class="callout">
  <strong>Defects &amp; misbuilds:</strong> Record every defect, wrong assembly, damage, or misbuild on the <strong>Quality / Six Sigma</strong> page (defect log and CAPA).
  Use the table below for floor notes; transfer to the system the same day.
</div>
<h2>Floor notes — defects / misbuilds (also log on Quality / Six Sigma)</h2>
<table><thead><tr><th>Time</th><th>Order / build ref</th><th>Description</th><th style="text-align:center">☐ Logged on Quality / Six Sigma</th></tr></thead><tbody>${defectRows}</tbody></table>

<p class="muted" style="font-size:0.8rem;margin-top:1.5rem;">OptiDoll Sigma — Daily plan form. Checkboxes are for print/fill; use Adobe Reader or browser print to PDF if needed.</p>
</div>
<script>document.querySelector("button")?.focus();</script>
</body></html>`;

  return html;
}

/** Opens the daily plan in a new tab for browser print / Save as PDF. */
function openDailyPlanFormWindow(opts) {
  const html = buildDailyPlanFullHtml(opts);
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    return false;
  }
  w.document.write(html);
  w.document.close();
  return true;
}

/**
 * Renders the daily plan in a hidden frame and downloads a PDF (A4, client-side).
 */
async function downloadDailyPlanPdf(opts) {
  const html = buildDailyPlanFullHtml(opts);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Daily plan PDF export");
  iframe.style.cssText = "position:fixed;left:-12000px;top:0;width:920px;height:20000px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) {
    iframe.remove();
    throw new Error("Could not create export frame.");
  }
  idoc.open();
  idoc.write(html);
  idoc.close();
  await new Promise((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(resolve, 600);
  });
  const root = idoc.body;
  if (!root) {
    iframe.remove();
    throw new Error("Empty export document.");
  }
  const rawLabel = String(opts.planDateLabel || "plan").replace(/[/\\?%*:|"<>]/g, "-");
  const filename = `OptiDoll-Daily-Plan-${rawLabel}.pdf`;
  const html2pdf = (await import("html2pdf.js")).default;
  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(root)
    .save();
  iframe.remove();
}

/** Trim cells, drop blank lines, strip BOM, normalize header names to canonical spelling when case-only differs; pad ragged rows for display. */
function cleanCsvToMatrix(text) {
  const warnings = [];
  const rawLines = stripUtf8Bom(text).split(/\r?\n/);
  const matrix = [];
  for (const line of rawLines) {
    if (!String(line).trim()) continue;
    const cells = splitCsvLine(line).map((c) => {
      let v = c.trim();
      if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
        v = v.slice(1, -1).replace(/""/g, '"');
      }
      return v.trim();
    });
    if (cells.every((x) => !x)) continue;
    matrix.push(cells);
  }
  if (!matrix.length) {
    return { fullMatrix: [], warnings: ["No rows after removing empty lines."], cleanedCsv: "" };
  }
  const widths = matrix.map((r) => r.length);
  const maxW = Math.max(...widths);
  const minW = Math.min(...widths);
  if (maxW !== minW) {
    warnings.push(`Ragged rows detected (${minW}–${maxW} fields); shorter rows padded with blanks for preview.`);
    for (const r of matrix) {
      while (r.length < maxW) r.push("");
    }
  }
  const canonicalLower = REQUIRED_CSV_HEADERS.map((h) => h.toLowerCase());
  const headerLower = matrix[0].map((h) => String(h).toLowerCase().trim());
  matrix[0] = matrix[0].map((h, i) => {
    const idx = canonicalLower.indexOf(headerLower[i]);
    return idx >= 0 ? REQUIRED_CSV_HEADERS[idx] : String(h).trim();
  });
  const linesOut = matrix.map((r) =>
    r.map((c) => {
      const s = String(c);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  const cleanedCsv = `${linesOut.join("\n")}\n`;
  return { fullMatrix: matrix, warnings, cleanedCsv };
}

function validateCleanedMatrix(matrix) {
  if (!matrix || matrix.length < 2) {
    return { ok: false, message: "CSV has no header + data rows after cleaning." };
  }
  const headerCells = matrix[0].map((h) => String(h).toLowerCase().trim());
  const missing = REQUIRED_CSV_HEADERS.filter((h) => !headerCells.includes(h));
  if (missing.length > 0) {
    return { ok: false, message: `Missing required headers: ${missing.join(", ")}.` };
  }
  const width = matrix[0].length;
  const uneven = matrix.slice(1).some((row) => row.length !== width);
  if (uneven) {
    return { ok: false, message: "Column count still inconsistent after cleaning." };
  }
  return {
    ok: true,
    message: `OK: ${matrix.length - 1} data rows, ${width} columns (cleaned).`,
  };
}

function cleanSqlText(text) {
  return stripUtf8Bom(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {{ fileName: string, fileSize: number, fileType: string, validationSummary: string, sections: Array<{ kind: "table"|"pre", title: string, headers?: string[], rows?: string[][], text?: string }> }} opts
 */
function openCleanedDataPreview(opts) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    return false;
  }
  const generatedAt = new Date().toLocaleString();
  const rowCap = 2500;
  let body = "";
  for (const sec of opts.sections) {
    if (sec.kind === "table" && sec.headers?.length) {
      const head = sec.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
      const allRows = sec.rows ?? [];
      const slice = allRows.slice(0, rowCap);
      const note =
        allRows.length > rowCap
          ? `<p class="note">Showing first ${rowCap} of ${allRows.length} data rows.</p>`
          : "";
      body += `<h2>${escapeHtml(sec.title)}</h2>${note}<div class="wrap"><table><thead><tr>${head}</tr></thead><tbody>`;
      for (const r of slice) {
        body += `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`;
      }
      body += "</tbody></table></div>";
    } else if (sec.kind === "pre" && sec.text != null) {
      body += `<h2>${escapeHtml(sec.title)}</h2><pre>${escapeHtml(sec.text)}</pre>`;
    }
  }
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Cleaned — ${escapeHtml(opts.fileName)}</title>
<style>
  body { font-family: system-ui, "Segoe UI", sans-serif; margin: 0; background: #f1f5f9; color: #0f172a; }
  .bar { background: linear-gradient(135deg, #2d2640, #5c4d8a); color: #fff; padding: 1rem 1.25rem; }
  .bar h1 { margin: 0; font-size: 1.2rem; font-weight: 800; }
  .meta { font-size: 0.82rem; opacity: 0.95; margin-top: 0.4rem; line-height: 1.45; }
  .sum { margin: 1rem; padding: 0.85rem 1rem; background: #e0e7ff; border-radius: 10px; font-size: 0.9rem; border: 1px solid #c7d2fe; }
  .wrap { overflow: auto; margin: 0 1rem 1rem; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); }
  table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 700; position: sticky; top: 0; z-index: 1; }
  tr:nth-child(even) { background: #fafafa; }
  h2 { margin: 1.25rem 1rem 0.5rem; font-size: 1rem; color: #334155; font-weight: 700; }
  pre { margin: 0 1rem 1rem; padding: 1rem; background: #1e293b; color: #e2e8f0; border-radius: 10px; overflow: auto; font-size: 0.78rem; white-space: pre-wrap; word-break: break-word; }
  .note { margin: 0.25rem 1rem; font-size: 0.8rem; color: #64748b; }
</style></head><body>
<div class="bar"><h1>Cleaned data preview</h1>
<div class="meta"><strong>Data source:</strong> ${escapeHtml(opts.fileName)}<br/>
<strong>Type:</strong> ${escapeHtml(opts.fileType)} · <strong>Size:</strong> ${opts.fileSize.toLocaleString()} bytes<br/>
<strong>Opened:</strong> ${escapeHtml(generatedAt)}</div></div>
<div class="sum"><strong>Validation:</strong> ${escapeHtml(opts.validationSummary)}</div>
${body}
</body></html>`);
  w.document.close();
  return true;
}

const PO_COMPANY_NAME = "OptiDoll Supply Chain";
const PO_BUYER_ADDRESS_LINES = ["1200 Commerce Drive", "Building C", "Logan, UT 84321", "United States"];
const PO_BUYER_PHONE = "+1 (555) 010-4200";
const PO_BUYER_EMAIL = "procurement@optidoll.example";
const PO_SHIP_TO_LINES = ["OptiDoll Fulfillment Center", "8800 Logistics Parkway", "Logan, UT 84321", "United States"];
const PO_TERMS_TEXT =
  "Payment: Net 30 days from invoice date unless otherwise agreed in writing. Prices are in USD. Title and risk of loss pass upon delivery to the ship-to address unless Incoterms state otherwise. Buyer may cancel undelivered quantities if shipment is delayed more than ten (10) business days beyond the requested delivery window.";
const PO_STORAGE_SEQ_PREFIX = "optidoll_po_seq_";

/** Local calendar date as YYYYMMDD (used in PO numbers). */
function formatPoDateCompact(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Reserve sequential PO numbers for today: YYYYMMDD-1, YYYYMMDD-2, …
 * Persisted in localStorage so repeat exports advance the sequence.
 */
function allocPurchaseOrderNumbers(count) {
  if (count < 1) return [];
  const dateKey = formatPoDateCompact();
  const storageKey = `${PO_STORAGE_SEQ_PREFIX}${dateKey}`;
  let start = 0;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw != null ? Number.parseInt(raw, 10) : 0;
    start = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    /* localStorage unavailable */
  }
  const nums = [];
  for (let i = 0; i < count; i += 1) {
    nums.push(`${dateKey}-${start + i + 1}`);
  }
  try {
    localStorage.setItem(storageKey, String(start + count));
  } catch {
    /* quota / private mode */
  }
  return nums;
}

function vendorGroupsEquivalent(a, b) {
  return (
    String(a?.vendorName) === String(b?.vendorName) &&
    String(a?.vendorCountry) === String(b?.vendorCountry) &&
    String(a?.supplierCode ?? "") === String(b?.supplierCode ?? "")
  );
}

/** Landed unit cost (base + shipping + tariff on base). */
function landedSupplierUnitCost(sp) {
  const base = Number(sp.base_cost ?? 0);
  const ship = Number(sp.shipping_cost_per_unit ?? 0);
  const tar = Number(sp.tariff_rate ?? 0);
  return base + ship + base * tar;
}

function pickBestSupplierPart(links) {
  if (!links?.length) return null;
  const primary = links.find((l) => l.is_primary);
  if (primary) return primary;
  return [...links].sort((a, b) => landedSupplierUnitCost(a) - landedSupplierUnitCost(b))[0];
}

function normalizePartNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function indexSupplierLinks(supplierLinks) {
  const byPartId = new Map();
  const byPartName = new Map();
  for (const link of supplierLinks) {
    const pid = link.part;
    if (pid != null) {
      if (!byPartId.has(pid)) byPartId.set(pid, []);
      byPartId.get(pid).push(link);
    }
    const pn = link.part_detail?.part_name;
    if (pn) {
      const key = normalizePartNameKey(pn);
      if (!byPartName.has(key)) byPartName.set(key, []);
      byPartName.get(key).push(link);
    }
  }
  return { byPartId, byPartName };
}

/**
 * EOM target: raise on-hand to ~2× reorder point (monthly coverage heuristic).
 */
function buildEndOfMonthReorderLines(inventoryRows, supplierLinks) {
  const { byPartId, byPartName } = indexSupplierLinks(supplierLinks);
  const lines = [];

  for (const row of inventoryRows) {
    const available = Number(row.available_qty ?? row.on_hand_qty ?? 0);
    const reorderPoint = Number(row.reorder_point_qty ?? 0);
    const eomQty = Math.max(0, Math.ceil(reorderPoint * 2 - available));
    if (eomQty === 0) continue;

    const partDetail = row.part_detail;
    const partName =
      partDetail?.part_name || row.part?.part_name || (typeof row.part === "string" ? row.part : "") || "Part";
    const bodyType = partDetail?.part_type ?? inferPartTypeFromName(String(partName));
    const partId = partDetail?.id ?? row.part;

    let links = [];
    if (typeof partId === "number") {
      links = byPartId.get(partId) ?? [];
    } else if (typeof partId === "string" && /^\d+$/.test(partId)) {
      links = byPartId.get(Number(partId)) ?? [];
    }
    if (!links.length) {
      links = byPartName.get(normalizePartNameKey(partName)) ?? [];
    }

    const best = pickBestSupplierPart(links);
    const unitCost = best != null ? landedSupplierUnitCost(best) : null;

    lines.push({
      bodyType,
      bodyPartLabel: formatPartTypeLabel(bodyType),
      partName,
      vendorName: best?.supplier_detail?.supplier_name ?? "—",
      vendorCountry: best?.supplier_detail?.country ?? "—",
      supplierCode: best?.supplier_detail?.supplier_code ?? "",
      unitCost,
      qty: eomQty,
      lineTotal: unitCost != null ? unitCost * eomQty : null,
      hasVendor: Boolean(best && unitCost != null),
    });
  }

  return lines.sort((a, b) => compareByBodyPartThenName(a.bodyType, a.partName, b.bodyType, b.partName));
}

function groupReorderLinesByVendor(lines) {
  const map = new Map();
  for (const line of lines) {
    const key = line.hasVendor
      ? `v:${line.vendorName}|${line.vendorCountry}|${line.supplierCode}`
      : "u:unassigned";
    if (!map.has(key)) {
      map.set(key, {
        vendorName: line.vendorName,
        vendorCountry: line.vendorCountry,
        supplierCode: line.supplierCode,
        lines: [],
        hasVendor: line.hasVendor,
      });
    }
    map.get(key).lines.push(line);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.hasVendor !== b.hasVendor) return a.hasVendor ? -1 : 1;
    return String(a.vendorName).localeCompare(String(b.vendorName), undefined, { sensitivity: "base" });
  });
}

/**
 * Full HTML document: one page per vendor (B2B purchase order + logo).
 * PO numbers: YYYYMMDD-# sequential for the session day (see allocPurchaseOrderNumbers).
 * @returns {string|null} HTML document, or null if there is nothing to export
 */
function buildPurchaseOrdersDocumentHtml(vendorGroups, logoSrc) {
  const issued = new Date();
  const issuedStr = issued.toLocaleDateString(undefined, { dateStyle: "long" });
  const deliveryStr = new Date(issued.getFullYear(), issued.getMonth() + 1, 0).toLocaleDateString(undefined, {
    dateStyle: "long",
  });

  const sheets = [];
  for (const group of vendorGroups) {
    const poLines = group.lines.filter((l) => l.hasVendor && l.unitCost != null);
    if (poLines.length) sheets.push({ group, poLines });
  }

  if (!sheets.length) return null;

  const poNumbers = allocPurchaseOrderNumbers(sheets.length);
  const billToHtml = [escapeHtml(PO_COMPANY_NAME), ...PO_BUYER_ADDRESS_LINES.map((ln) => escapeHtml(ln))].join("<br/>");
  const shipToHtml = PO_SHIP_TO_LINES.map((ln) => escapeHtml(ln)).join("<br/>");

  let pagesHtml = "";
  sheets.forEach(({ group, poLines }, sheetIdx) => {
    const poNum = poNumbers[sheetIdx];
    const subtotal = poLines.reduce((s, line) => s + (line.lineTotal ?? 0), 0);
    const taxAmount = 0;
    const grandTotal = subtotal + taxAmount;
    const vc = String(group.supplierCode || "").trim() || "—";

    const tableRows = poLines
      .map((line, i) => {
        const ext = (line.unitCost ?? 0) * line.qty;
        return `<tr><td class="num">${i + 1}</td><td>${escapeHtml(line.partName)}</td><td>${escapeHtml(line.bodyPartLabel)}</td><td class="num">${line.qty}</td><td class="cen">EA</td><td class="num">${(line.unitCost ?? 0).toFixed(2)}</td><td class="num">${ext.toFixed(2)}</td></tr>`;
      })
      .join("");

    const safeLogo = String(logoSrc || "").replace(/"/g, "");

    pagesHtml += `
<section class="po-sheet">
  <header class="po-top">
    <div class="po-top-left">
      <div class="brand"><img src="${safeLogo}" alt="" class="logo" width="132" height="auto" /></div>
      <div class="doc-id">
        <span class="doc-label">Purchase order</span>
        <span class="po-number">${escapeHtml(poNum)}</span>
      </div>
    </div>
    <div class="po-top-right">
      <table class="kv">
        <tr><th>Issue date</th><td>${escapeHtml(issuedStr)}</td></tr>
        <tr><th>Currency</th><td>USD</td></tr>
        <tr><th>Requested delivery</th><td>${escapeHtml(deliveryStr)} <span class="hint">(EOM)</span></td></tr>
        <tr><th>Payment terms</th><td>Net 30</td></tr>
      </table>
    </div>
  </header>
  <p class="buyer-legal">${escapeHtml(PO_COMPANY_NAME)}</p>
  <div class="grid-3">
    <div class="box">
      <div class="lbl">Bill to</div>
      <div class="box-body">${billToHtml}<br/>${escapeHtml(PO_BUYER_PHONE)}<br/><a href="mailto:${escapeHtml(PO_BUYER_EMAIL)}">${escapeHtml(PO_BUYER_EMAIL)}</a></div>
    </div>
    <div class="box">
      <div class="lbl">Ship to</div>
      <div class="box-body">${shipToHtml}</div>
    </div>
    <div class="box">
      <div class="lbl">Supplier (vendor)</div>
      <div class="box-body"><strong>${escapeHtml(group.vendorName)}</strong><br/>${escapeHtml(group.vendorCountry)}<br/><span class="meta-line">Vendor code: ${escapeHtml(vc)}</span></div>
    </div>
  </div>
  <p class="intro">Please supply the following materials in accordance with the quantities and unit pricing below. Reference this PO number on all order acknowledgments, packing slips, and invoices.</p>
  <table class="po-table">
    <thead>
      <tr><th class="num">#</th><th>Description</th><th>Category</th><th class="num">Qty</th><th class="cen">UOM</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="totals">
    <table class="totals-inner">
      <tr><td>Subtotal</td><td class="num">$${subtotal.toFixed(2)}</td></tr>
      <tr><td>Estimated tax <span class="hint">(if applicable)</span></td><td class="num">$${taxAmount.toFixed(2)}</td></tr>
      <tr class="grand"><td><strong>Total (USD)</strong></td><td class="num"><strong>$${grandTotal.toFixed(2)}</strong></td></tr>
    </table>
  </div>
  <div class="terms-block">
    <div class="lbl">Terms &amp; conditions</div>
    <p class="terms">${escapeHtml(PO_TERMS_TEXT)}</p>
  </div>
  <div class="sig-grid">
    <div class="sig-cell"><span class="lbl">Authorized buyer</span><div class="sig-line"></div><span class="sig-hint">Name &amp; title</span></div>
    <div class="sig-cell"><span class="lbl">Date</span><div class="sig-line"></div></div>
  </div>
  <p class="footer-note">Questions regarding this purchase order: ${escapeHtml(PO_BUYER_EMAIL)} · ${escapeHtml(PO_BUYER_PHONE)}</p>
</section>`;
  });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Purchase Orders — ${escapeHtml(PO_COMPANY_NAME)}</title>
<style>
  @page { margin: 0.55in; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; margin: 0; color: #0f172a; background: #f1f5f9; font-size: 14px; line-height: 1.45; }
  .po-sheet { background: #fff; max-width: 920px; margin: 0 auto 1.75rem; padding: 1.35rem 1.6rem 1.75rem; box-shadow: 0 2px 16px rgba(15,23,42,0.07); page-break-after: always; border: 1px solid #e2e8f0; }
  .po-sheet:last-child { page-break-after: auto; margin-bottom: 0; }
  .po-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.25rem; border-bottom: 3px solid #1e3a5f; padding-bottom: 1rem; margin-bottom: 1rem; }
  .po-top-left { display: flex; align-items: flex-end; gap: 1.25rem; flex-wrap: wrap; }
  .logo { max-height: 48px; width: auto; display: block; }
  .doc-id { display: flex; flex-direction: column; gap: 0.15rem; }
  .doc-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; font-weight: 700; }
  .po-number { font-size: 1.35rem; font-weight: 800; color: #1e3a5f; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; }
  .po-top-right .kv { border-collapse: collapse; font-size: 0.82rem; }
  .po-top-right .kv th, .po-top-right .kv td { padding: 3px 0 3px 12px; text-align: left; vertical-align: top; }
  .po-top-right .kv th { color: #64748b; font-weight: 600; white-space: nowrap; }
  .buyer-legal { margin: 0 0 0.85rem; font-size: 0.95rem; font-weight: 700; color: #334155; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.85rem; margin-bottom: 1rem; }
  @media print { .grid-3 { grid-template-columns: 1fr 1fr 1fr; } }
  .box { border: 1px solid #e2e8f0; border-radius: 4px; padding: 0.65rem 0.75rem; background: #fafafa; min-height: 6.5rem; }
  .box-body { font-size: 0.86rem; color: #1e293b; }
  .box-body a { color: #1e3a5f; text-decoration: none; }
  .lbl { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 0.35rem; }
  .meta-line { font-size: 0.8rem; color: #475569; }
  .intro { font-size: 0.84rem; color: #475569; margin: 0 0 0.75rem; }
  .hint { font-size: 0.78rem; color: #94a3b8; font-weight: 400; }
  .po-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
  .po-table th, .po-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
  .po-table th { background: #e8eef5; font-weight: 700; color: #1e293b; }
  .po-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .po-table .cen { text-align: center; }
  .totals { display: flex; justify-content: flex-end; margin-top: 0.85rem; }
  .totals-inner { border-collapse: collapse; min-width: 280px; font-size: 0.9rem; }
  .totals-inner td { padding: 6px 10px; border: 1px solid #e2e8f0; }
  .totals-inner td.num { text-align: right; font-variant-numeric: tabular-nums; background: #fff; }
  .totals-inner tr.grand td { background: #f1f5f9; border-top: 2px solid #1e3a5f; }
  .terms-block { margin-top: 1.15rem; padding-top: 0.85rem; border-top: 1px solid #e2e8f0; }
  .terms { margin: 0.35rem 0 0; font-size: 0.78rem; color: #475569; line-height: 1.5; }
  .sig-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-top: 1.35rem; }
  .sig-cell .sig-line { border-bottom: 1px solid #334155; min-height: 2.25rem; margin-top: 0.25rem; }
  .sig-hint { font-size: 0.72rem; color: #94a3b8; }
  .footer-note { margin: 1.25rem 0 0; font-size: 0.75rem; color: #64748b; text-align: center; }
</style></head><body>${pagesHtml}</body></html>`;
}

/** @returns {boolean} false if pop-up blocked */
function openHtmlDocumentInNewTab(html) {
  if (!html) return false;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

const INVENTORY_FALLBACK_ROWS = [
  { id: 1, part: "Arm Deep", available_qty: 184, reorder_point_qty: 77, risk: "yellow" },
  { id: 2, part: "Eyes Blue", available_qty: 216, reorder_point_qty: 93, risk: "green" },
  {
    id: 3,
    part: 92001,
    part_detail: { id: 92001, part_name: "Leg Deep", part_type: "leg" },
    available_qty: 216,
    reorder_point_qty: 93,
    risk: "yellow",
  },
  {
    id: 4,
    part: 92002,
    part_detail: { id: 92002, part_name: "Leg Light", part_type: "leg" },
    available_qty: 220,
    reorder_point_qty: 95,
    risk: "green",
  },
  {
    id: 5,
    part: 92003,
    part_detail: { id: 92003, part_name: "Leg Medium", part_type: "leg" },
    available_qty: 224,
    reorder_point_qty: 97,
    risk: "green",
  },
];

/** Supplier-part rows aligned by part name with {@link INVENTORY_FALLBACK_ROWS} when API is offline. */
const SUPPLIER_PARTS_FALLBACK = [
  {
    id: 90001,
    part: 91001,
    is_primary: true,
    base_cost: "2.55",
    shipping_cost_per_unit: "0.40",
    tariff_rate: "0.05",
    part_detail: { id: 91001, part_name: "Arm Deep", part_type: "arm" },
    supplier_detail: { supplier_code: "SUP-ARM-US", supplier_name: "Armstrong Plastics LLC", country: "USA" },
  },
  {
    id: 90002,
    part: 91002,
    is_primary: true,
    base_cost: "1.89",
    shipping_cost_per_unit: "0.22",
    tariff_rate: "0.03",
    part_detail: { id: 91002, part_name: "Eyes Blue", part_type: "eyes" },
    supplier_detail: { supplier_code: "SUP-EYE-VN", supplier_name: "Vietnam Optics Collective", country: "Vietnam" },
  },
  {
    id: 90003,
    part: 92001,
    is_primary: true,
    base_cost: "1.72",
    shipping_cost_per_unit: "0.28",
    tariff_rate: "0.04",
    part_detail: { id: 92001, part_name: "Leg Deep", part_type: "leg" },
    supplier_detail: { supplier_code: "SUP-LIMB-MX", supplier_name: "Monterrey Limb Works", country: "Mexico" },
  },
  {
    id: 90004,
    part: 92002,
    is_primary: true,
    base_cost: "1.68",
    shipping_cost_per_unit: "0.26",
    tariff_rate: "0.04",
    part_detail: { id: 92002, part_name: "Leg Light", part_type: "leg" },
    supplier_detail: { supplier_code: "SUP-LIMB-MX", supplier_name: "Monterrey Limb Works", country: "Mexico" },
  },
  {
    id: 90005,
    part: 92003,
    is_primary: true,
    base_cost: "1.70",
    shipping_cost_per_unit: "0.27",
    tariff_rate: "0.04",
    part_detail: { id: 92003, part_name: "Leg Medium", part_type: "leg" },
    supplier_detail: { supplier_code: "SUP-LIMB-MX", supplier_name: "Monterrey Limb Works", country: "Mexico" },
  },
];

function UploadData() {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  const [reimportingId, setReimportingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [selectedFile, setSelectedFile] = useState(null);

  const loadUploads = () => {
    getUploads()
      .then((list) => setRows(Array.isArray(list) ? list.slice(0, 12) : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    loadUploads();
  }, []);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  /** Prefer the live input FileList so Upload works if the user clicks before React commits `selectedFile`. */
  const getChosenFile = () => fileInputRef.current?.files?.[0] ?? selectedFile;

  const runUpload = () => {
    const file = getChosenFile();
    if (!file) {
      showSnackbar("Choose a file first.", "warning");
      return;
    }
    setUploading(true);
    uploadDataFile(file)
      .then((record) => {
        showSnackbar(`Uploaded “${record.original_filename}” (id ${record.id}).`, "success");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadUploads();
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Upload failed. Is the Django API running at http://127.0.0.1:8000 ?";
        showSnackbar(String(msg), "error");
      })
      .finally(() => setUploading(false));
  };

  const runValidate = async () => {
    const file = getChosenFile();
    if (!file) {
      showSnackbar("Choose a file first.", "warning");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (["xlsx", "xls"].includes(ext)) {
      showSnackbar("Excel selected. Export as CSV or use the DollPartsCatalog templates for validation.", "info");
      return;
    }
    if (!["csv", "txt", "sql", "zip"].includes(ext)) {
      showSnackbar("Unsupported type. Use CSV, TXT, ZIP, or SQL seed files.", "warning");
      return;
    }

    setValidating(true);
    try {
      const maxText = Math.min(file.size, 1_500_000);

      if (ext === "zip") {
        const buf = new Uint8Array(await file.arrayBuffer());
        let entries;
        try {
          entries = unzipSync(buf);
        } catch {
          showSnackbar("Could not read ZIP (corrupt or not a zip file).", "error");
          return;
        }
        const csvPaths = Object.keys(entries).filter(
          (n) => !n.endsWith("/") && n.toLowerCase().endsWith(".csv")
        );
        if (!csvPaths.length) {
          showSnackbar("ZIP contains no .csv files to validate.", "warning");
          return;
        }
        csvPaths.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        const sections = [];
        const summaryBits = [];
        let passed = 0;
        for (const p of csvPaths) {
          let text;
          try {
            text = strFromU8(entries[p]);
          } catch {
            summaryBits.push(`${p}: decode error`);
            continue;
          }
          const cleaned = cleanCsvToMatrix(text);
          const result = validateCleanedMatrix(cleaned.fullMatrix);
          const warnExtra = cleaned.warnings.length ? ` ${cleaned.warnings.join(" ")}` : "";
          summaryBits.push(`${p}: ${result.message}${warnExtra}`);
          if (result.ok) passed += 1;
          if (cleaned.fullMatrix.length > 0) {
            sections.push({
              kind: "table",
              title: `Inside ZIP — ${p}`,
              headers: cleaned.fullMatrix[0],
              rows: cleaned.fullMatrix.slice(1),
            });
          }
        }
        const validationSummary = summaryBits.join(" · ");
        const opened = openCleanedDataPreview({
          fileName: file.name,
          fileSize: file.size,
          fileType: "ZIP archive (CSV extracts)",
          validationSummary,
          sections,
        });
        if (!opened) {
          const clip =
            validationSummary.length > 280 ? `${validationSummary.slice(0, 280)}…` : validationSummary;
          showSnackbar(`Pop-up blocked — allow pop-ups to see cleaned tables. ${clip}`, "warning");
        } else if (passed === csvPaths.length) {
          showSnackbar(`ZIP: cleaned & previewed ${csvPaths.length} CSV file(s).`, "success");
        } else if (passed === 0) {
          showSnackbar(`ZIP: preview open — fix issues noted in the new window.`, "warning");
        } else {
          showSnackbar(`ZIP: ${passed}/${csvPaths.length} CSV(s) passed validation; see preview.`, "warning");
        }
        return;
      }

      const text = stripUtf8Bom(await file.slice(0, maxText).text());

      if (ext === "sql") {
        const cleanedSql = cleanSqlText(text);
        const hasCols =
          /part_number/i.test(cleanedSql) &&
          /part_name/i.test(cleanedSql) &&
          /available_qty/i.test(cleanedSql) &&
          /reorder_point_qty/i.test(cleanedSql);
        const hasInsert = /insert\s+into/i.test(cleanedSql) && /values/i.test(cleanedSql);
        const sqlOk = hasCols && hasInsert;
        const validationSummary = sqlOk
          ? "SQL seed structure looks valid (INSERT + canonical columns)."
          : "SQL issues: need INSERT ... VALUES with part_number, part_name, available_qty, reorder_point_qty.";
        const opened = openCleanedDataPreview({
          fileName: file.name,
          fileSize: file.size,
          fileType: "SQL seed",
          validationSummary,
          sections: [{ kind: "pre", title: "Cleaned SQL (whitespace normalized)", text: cleanedSql }],
        });
        if (!opened) {
          showSnackbar(`Pop-up blocked — allow pop-ups to see cleaned SQL. ${validationSummary}`, "warning");
        } else {
          showSnackbar(
            sqlOk ? "SQL cleaned — preview opened." : "SQL preview opened; fix structure if needed.",
            sqlOk ? "success" : "warning"
          );
        }
        return;
      }

      const cleaned = cleanCsvToMatrix(text);
      const result = validateCleanedMatrix(cleaned.fullMatrix);
      const warnExtra = cleaned.warnings.length ? ` ${cleaned.warnings.join(" ")}` : "";
      const validationSummary = `${result.message}${warnExtra}`;
      const sections =
        cleaned.fullMatrix.length > 0
          ? [
              {
                kind: "table",
                title: "Cleaned CSV",
                headers: cleaned.fullMatrix[0],
                rows: cleaned.fullMatrix.slice(1),
              },
            ]
          : [];
      const opened = openCleanedDataPreview({
        fileName: file.name,
        fileSize: file.size,
        fileType: ext.toUpperCase(),
        validationSummary,
        sections,
      });
      if (!opened) {
        const clip =
          validationSummary.length > 280 ? `${validationSummary.slice(0, 280)}…` : validationSummary;
        showSnackbar(`Pop-up blocked — allow pop-ups to see cleaned CSV. ${clip}`, "warning");
      } else {
        showSnackbar(
          result.message + (cleaned.warnings.length ? ` ${cleaned.warnings[0]}` : ""),
          result.ok ? "success" : "warning"
        );
      }
    } catch {
      showSnackbar("Could not read file.", "error");
    } finally {
      setValidating(false);
    }
  };

  const onSelectUpload = (uploadId) => {
    setSelectedUploadId(uploadId);
    showSnackbar(`Selected upload #${uploadId}. Use Re-import to apply this file again.`, "info");
  };

  const onReimportSelected = (uploadId) => {
    setReimportingId(uploadId);
    reimportUpload(uploadId)
      .then((record) => {
        showSnackbar(
          `Re-imported ${record.original_filename} (${record.import_status || "updated"}).`,
          "success"
        );
        loadUploads();
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err?.message || "Could not re-import selected upload.";
        showSnackbar(String(msg), "error");
      })
      .finally(() => setReimportingId(null));
  };

  const onDeleteUpload = (uploadId) => {
    setDeletingId(uploadId);
    deleteUpload(uploadId)
      .then(() => {
        if (selectedUploadId === uploadId) setSelectedUploadId(null);
        showSnackbar(`Deleted upload #${uploadId}.`, "success");
        loadUploads();
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err?.message || "Could not delete upload.";
        showSnackbar(String(msg), "error");
      })
      .finally(() => setDeletingId(null));
  };

  return (
    <Page title="Upload Data" subtitle="Import operational datasets and validate them before planning runs.">
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileChange}
        style={{ display: "none" }}
        accept=".csv,.xlsx,.xls,.zip,.sql,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,text/plain"
      />

      <CardBox title="Accepted Input Files">
        <Typography>Upload CSV, XLSX, ZIP of CSV files, or SQL seed files to the Django API (saved under media/uploads/).</Typography>

        <Alert severity="info" sx={{ mt: 2 }}>
          Start the backend (port 8000) with Postgres configured. Excel conversion and full validation run server-side in a future step;
          this flow stores the file and creates a DataUpload record you can inspect in Django admin or below.
        </Alert>

        {selectedFile ? (
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Selected: <strong>{selectedFile.name}</strong> ({Math.round(selectedFile.size / 1024)} KB)
          </Typography>
        ) : null}

        <Typography variant="subtitle1" sx={{ mt: 2.5, fontWeight: 800 }}>
          Template Starter Kit
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Professional, standardized templates keep CSV, ZIP, and SQL seed files aligned with backend ingest rules.
        </Typography>
        <Alert
          severity="info"
          sx={{
            mt: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: (t) => alpha(t.palette.info.main, 0.28),
            backgroundColor: (t) => alpha(t.palette.info.light, 0.12),
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            Template Requirements
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Chip size="small" label="part_number (required)" color="secondary" variant="outlined" />
            <Chip size="small" label="part_name (required)" color="secondary" variant="outlined" />
            <Chip size="small" label="available_qty (required)" color="secondary" variant="outlined" />
            <Chip size="small" label="reorder_point_qty (required)" color="secondary" variant="outlined" />
          </Stack>
          <Typography variant="body2" sx={{ mt: 1.25 }}>
            Accepted inputs: CSV, ZIP containing CSV files, or SQL seed files with matching canonical columns.
          </Typography>
        </Alert>

        <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Button type="button" variant="contained" color="secondary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadTemplate("template-zip")}>
            Download ZIP starter kit
          </Button>
          <Button type="button" variant="outlined" color="secondary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadTemplate("template-sql")}>
            Download SQL template
          </Button>
          <Button type="button" variant="outlined" color="secondary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadTemplate("template-csv")}>
            Download CSV template
          </Button>
        </Stack>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>
          DollPartsCatalog downloads (same data as API templates)
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Button type="button" variant="contained" color="primary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMediaFile("DollPartsCatalog.zip")}>
            Download DollPartsCatalog.zip
          </Button>
          <Button type="button" variant="outlined" color="primary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMediaFile("DollPartsCatalog.csv")}>
            Download DollPartsCatalog.csv
          </Button>
          <Button type="button" variant="outlined" color="primary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadMediaFile("DollPartsCatalog.sql")}>
            Download DollPartsCatalog.sql
          </Button>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mt: 3, flexWrap: "wrap", alignItems: "center" }}>
          <Button type="button" variant="outlined" color="secondary" onClick={onPickFile}>
            Choose file
          </Button>
          <Button
            type="button"
            variant="contained"
            color="primary"
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
            disabled={uploading}
            onClick={runUpload}
          >
            Upload to server
          </Button>
          <Button
            type="button"
            variant="outlined"
            color="secondary"
            disabled={validating}
            onClick={runValidate}
          >
            Validate file
          </Button>
        </Stack>
      </CardBox>

      <CardBox title="Recent uploads">
        {rows.length === 0 ? (
          <Typography color="text.secondary">No records yet (or API unreachable).</Typography>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>File</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Validation</TableCell>
                  <TableCell>Import</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const isSelected = selectedUploadId === r.id;
                  return (
                    <TableRow
                      key={r.id}
                      hover
                      selected={isSelected}
                      onClick={() => setSelectedUploadId(r.id)}
                      sx={{
                        cursor: "pointer",
                        backgroundColor: isSelected ? (t) => alpha(t.palette.primary.main, 0.08) : undefined,
                      }}
                    >
                      <TableCell width={24}>{isSelected ? "●" : ""}</TableCell>
                      <TableCell>{r.original_filename ?? "—"}</TableCell>
                      <TableCell>{String(r.original_file_type ?? "—").toUpperCase()}</TableCell>
                      <TableCell>{r.validation_status ?? "—"}</TableCell>
                      <TableCell>{r.import_status ?? "—"}</TableCell>
                      <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                          <Button
                            type="button"
                            variant={isSelected ? "contained" : "outlined"}
                            size="small"
                            color="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectUpload(r.id);
                            }}
                          >
                            Select
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            color="primary"
                            startIcon={<ReplayIcon />}
                            disabled={reimportingId === r.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onReimportSelected(r.id);
                            }}
                          >
                            {reimportingId === r.id ? "Re-importing..." : "Re-import"}
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlinedIcon />}
                            disabled={deletingId === r.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteUpload(r.id);
                            }}
                          >
                            {deletingId === r.id ? "Deleting..." : "Delete"}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardBox>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Page>
  );
}

function Inventory() {
  const [rows, setRows] = useState([]);
  const [partLinks, setPartLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");
  const [safetyPanelOpen, setSafetyPanelOpen] = useState(false);
  const [reorderDrafts, setReorderDrafts] = useState({});
  const [savingSnapshotId, setSavingSnapshotId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [reorderPlanOpen, setReorderPlanOpen] = useState(false);
  const [reorderLines, setReorderLines] = useState([]);
  const [poPreviewOpen, setPoPreviewOpen] = useState(false);
  const [poPreviewHtml, setPoPreviewHtml] = useState("");
  const poPreviewFrameRef = useRef(null);

  const sortedInventoryRows = useMemo(() => [...rows].sort(compareInventorySnapshotRows), [rows]);

  const reorderByVendor = useMemo(() => groupReorderLinesByVendor(reorderLines), [reorderLines]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [invData, linkData] = await Promise.all([getInventory(), getSupplierParts()]);
        if (cancelled) return;
        setRows(invData.results || invData);
        const rawLinks = linkData.results || linkData;
        setPartLinks(Array.isArray(rawLinks) ? rawLinks : []);
        setSource("live");
      } catch {
        if (cancelled) return;
        setRows(INVENTORY_FALLBACK_ROWS);
        setPartLinks(SUPPLIER_PARTS_FALLBACK);
        setSource("mock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const generateReorderPlan = () => {
    const lines = buildEndOfMonthReorderLines(sortedInventoryRows, partLinks);
    setReorderLines(lines);
    setReorderPlanOpen(true);
    if (!lines.length) {
      showSnackbar("No EOM reorder lines — every part already at or above 2× reorder coverage.", "info");
    } else {
      const withVendor = lines.filter((l) => l.hasVendor).length;
      showSnackbar(`Master reorder plan: ${lines.length} line(s), ${withVendor} with a best vendor & cost.`, "success");
    }
  };

  const exportPurchaseOrders = () => {
    let lines = reorderLines;
    if (!lines.length) {
      lines = buildEndOfMonthReorderLines(sortedInventoryRows, partLinks);
      setReorderLines(lines);
    }
    const grouped = groupReorderLinesByVendor(lines).filter((g) => g.hasVendor);
    const priced = grouped.filter((g) => g.lines.some((l) => l.hasVendor && l.unitCost != null));
    if (!priced.length) {
      showSnackbar("No vendor-priced lines to export. Link parts to suppliers or generate a plan first.", "warning");
      return;
    }
    const logoSrc = `${window.location.origin}${import.meta.env.BASE_URL}optidoll-logo-premium.svg`;
    const docHtml = buildPurchaseOrdersDocumentHtml(priced, logoSrc);
    if (!docHtml) {
      showSnackbar("Could not build purchase order documents.", "warning");
      return;
    }
    setPoPreviewHtml(docHtml);
    setPoPreviewOpen(true);
    showSnackbar(
      `Purchase orders from the current plan are shown below (${formatPoDateCompact()}-# per vendor). Use Print or open in a new tab to save as PDF.`,
      "success"
    );
  };

  const exportPurchaseOrdersForVendor = (vendorGroup) => {
    let lines = reorderLines;
    if (!lines.length) {
      lines = buildEndOfMonthReorderLines(sortedInventoryRows, partLinks);
      setReorderLines(lines);
    }
    const match = groupReorderLinesByVendor(lines).find((g) => vendorGroupsEquivalent(g, vendorGroup));
    if (!match?.hasVendor) {
      showSnackbar("Assign a supplier to export a purchase order for this vendor.", "warning");
      return;
    }
    if (!match.lines.some((l) => l.hasVendor && l.unitCost != null)) {
      showSnackbar("No priced lines for this vendor. Link parts and costs in Suppliers.", "warning");
      return;
    }
    const logoSrc = `${window.location.origin}${import.meta.env.BASE_URL}optidoll-logo-premium.svg`;
    const docHtml = buildPurchaseOrdersDocumentHtml([match], logoSrc);
    if (!docHtml) {
      showSnackbar("Could not build this purchase order.", "warning");
      return;
    }
    setPoPreviewHtml(docHtml);
    setPoPreviewOpen(true);
    showSnackbar(`Purchase order for ${match.vendorName} is shown below — print or save as PDF.`, "success");
  };

  const printPoPreview = () => {
    poPreviewFrameRef.current?.contentWindow?.focus();
    poPreviewFrameRef.current?.contentWindow?.print();
  };

  const openPoPreviewInNewTab = () => {
    const ok = openHtmlDocumentInNewTab(poPreviewHtml);
    if (!ok) {
      showSnackbar("Allow pop-ups to open the purchase order in a new tab.", "warning");
    }
  };

  const closePoPreview = () => {
    setPoPreviewOpen(false);
    setPoPreviewHtml("");
  };

  const openSafetyPanel = () => {
    setReorderDrafts(
      Object.fromEntries(
        sortedInventoryRows.map((row) => [row.id, Number(row.reorder_point_qty ?? 0)])
      )
    );
    setSafetyPanelOpen(true);
  };

  const saveReorderPoint = (snapshotId) => {
    const nextValue = Number(reorderDrafts[snapshotId]);
    if (Number.isNaN(nextValue) || nextValue < 0) {
      showSnackbar("Reorder point must be a non-negative number.", "warning");
      return;
    }
    setSavingSnapshotId(snapshotId);
    updateInventoryReorderPoint(snapshotId, nextValue)
      .then((updated) => {
        setRows((prev) =>
          prev.map((row) =>
            row.id === snapshotId
              ? { ...row, reorder_point_qty: updated.reorder_point_qty }
              : row
          )
        );
        showSnackbar(`Saved reorder point for snapshot #${snapshotId}.`, "success");
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err?.message || "Could not save reorder point.";
        showSnackbar(String(msg), "error");
      })
      .finally(() => setSavingSnapshotId(null));
  };

  const saveAllReorderPoints = () => {
    const toSave = [];
    for (const row of rows) {
      const draft = reorderDrafts[row.id];
      const nextValue = Number(draft ?? row.reorder_point_qty ?? 0);
      if (Number.isNaN(nextValue) || nextValue < 0) {
        showSnackbar("Each reorder point must be a non-negative number.", "warning");
        return;
      }
      const current = Number(row.reorder_point_qty ?? 0);
      if (nextValue !== current) {
        toSave.push({ id: row.id, nextValue });
      }
    }
    if (toSave.length === 0) {
      showSnackbar("No changes to save.", "info");
      return;
    }
    setSavingAll(true);
    Promise.allSettled(toSave.map(({ id, nextValue }) => updateInventoryReorderPoint(id, nextValue)))
      .then((results) => {
        const updates = new Map();
        let ok = 0;
        let fail = 0;
        results.forEach((result, i) => {
          if (result.status === "fulfilled") {
            ok += 1;
            updates.set(toSave[i].id, result.value.reorder_point_qty);
          } else {
            fail += 1;
          }
        });
        setRows((prev) =>
          prev.map((row) =>
            updates.has(row.id) ? { ...row, reorder_point_qty: updates.get(row.id) } : row
          )
        );
        setReorderDrafts((prev) => {
          const next = { ...prev };
          updates.forEach((qty, id) => {
            next[id] = qty;
          });
          return next;
        });
        if (fail === 0) {
          showSnackbar(`Saved ${ok} reorder point update(s).`, "success");
        } else if (ok === 0) {
          showSnackbar("Could not save changes. Is the inventory API available?", "error");
        } else {
          showSnackbar(`Saved ${ok} update(s); ${fail} failed.`, "warning");
        }
      })
      .finally(() => setSavingAll(false));
  };

  return (
    <Page title="Inventory Control" subtitle="Monitor stock health and create replenishment actions quickly.">
      {source === "mock" ? <Alert severity="warning" sx={{ mb: 2 }}>Live inventory API unavailable. Showing fallback rows.</Alert> : null}
      <ActionRow
        actions={[
          { label: "Adjust Safety Stock", onClick: openSafetyPanel },
          { label: "Generate Reorder Plan", onClick: generateReorderPlan },
          { label: "Export Purchase Orders", variant: "outlined", color: "secondary", onClick: exportPurchaseOrders },
        ]}
      />
      <Dialog
        open={poPreviewOpen}
        onClose={closePoPreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: "min(90vh, 920px)", maxHeight: "95vh", display: "flex", flexDirection: "column" } }}
      >
        <DialogTitle sx={{ flexShrink: 0 }}>Purchase orders — preview</DialogTitle>
        <DialogContent sx={{ p: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {poPreviewHtml ? (
            <Box
              component="iframe"
              ref={poPreviewFrameRef}
              title="Purchase orders"
              srcDoc={poPreviewHtml}
              sx={{ flex: 1, width: "100%", border: 0, minHeight: 480, bgcolor: "#f1f5f9" }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ flexShrink: 0, flexWrap: "wrap", gap: 1 }}>
          <Button type="button" startIcon={<PrintOutlinedIcon />} variant="contained" color="primary" onClick={printPoPreview}>
            Print
          </Button>
          <Button type="button" startIcon={<OpenInNewIcon />} variant="outlined" onClick={openPoPreviewInNewTab}>
            Open in new tab
          </Button>
          <Button type="button" onClick={closePoPreview}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={reorderPlanOpen} onClose={() => setReorderPlanOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Master reorder plan (by vendor)</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            End-of-month order quantities target ~2× reorder point on-hand. Best vendor = primary supplier when set, else
            lowest landed unit cost (base + freight + tariff on base).
          </Typography>
          {!reorderLines.length ? (
            <Alert severity="info">No lines — all parts are at or above the EOM coverage target.</Alert>
          ) : (
            reorderByVendor.map((group) => (
              <Box key={`${group.vendorName}-${group.vendorCountry}-${group.supplierCode}`} sx={{ mb: 3 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {group.vendorName}
                    {group.vendorCountry && group.vendorCountry !== "—" ? ` · ${group.vendorCountry}` : ""}
                    {!group.hasVendor ? " (assign supplier)" : ""}
                  </Typography>
                  <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<FileDownloadOutlinedIcon />}
                    disabled={!group.hasVendor || !group.lines.some((l) => l.hasVendor && l.unitCost != null)}
                    onClick={() => exportPurchaseOrdersForVendor(group)}
                  >
                    Export PO
                  </Button>
                </Stack>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Body part</TableCell>
                        <TableCell>Part</TableCell>
                        <TableCell>Best vendor</TableCell>
                        <TableCell align="right">Unit cost (USD)</TableCell>
                        <TableCell align="right">EOM qty</TableCell>
                        <TableCell align="right">Extended (USD)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.lines.map((line, idx) => (
                        <TableRow key={`${line.partName}-${idx}`}>
                          <TableCell>{line.bodyPartLabel}</TableCell>
                          <TableCell>{line.partName}</TableCell>
                          <TableCell>
                            {line.hasVendor ? (
                              <>
                                {line.vendorName}
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                  {line.vendorCountry}
                                </Typography>
                              </>
                            ) : (
                              <Typography color="warning.main" variant="body2">
                                No supplier link — add in Suppliers
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {line.unitCost != null ? line.unitCost.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell align="right">{line.qty}</TableCell>
                          <TableCell align="right">
                            {line.lineTotal != null ? line.lineTotal.toFixed(2) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={exportPurchaseOrders} variant="contained" color="secondary">
            Export purchase orders
          </Button>
          <Button type="button" onClick={() => setReorderPlanOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      {safetyPanelOpen ? (
        <CardBox title="Adjust Safety Stock / Reorder Points">
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Edit reorder points per part, then save a single row or use Save all changes.
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Body part</TableCell>
                  <TableCell>Part</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell align="right">Reorder Point</TableCell>
                  <TableCell align="right">Save</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedInventoryRows.map((r) => (
                  <TableRow key={`safety-${r.id}`}>
                    <TableCell>
                      {formatPartTypeLabel(
                        r.part_detail?.part_type ??
                          inferPartTypeFromName(String(r.part_detail?.part_name || r.part?.part_name || r.part || ""))
                      )}
                    </TableCell>
                    <TableCell>{r.part_detail?.part_name || r.part?.part_name || r.part || "Part"}</TableCell>
                    <TableCell align="right">{Number(r.available_qty ?? r.on_hand_qty ?? 0)}</TableCell>
                    <TableCell align="right" sx={{ width: 180 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={reorderDrafts[r.id] ?? Number(r.reorder_point_qty ?? 0)}
                        onChange={(event) =>
                          setReorderDrafts((prev) => ({
                            ...prev,
                            [r.id]: event.target.value,
                          }))
                        }
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        type="button"
                        size="small"
                        variant="contained"
                        disabled={savingAll || savingSnapshotId === r.id}
                        onClick={() => saveReorderPoint(r.id)}
                      >
                        {savingSnapshotId === r.id ? "Saving..." : "Save"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="contained"
              color="primary"
              disabled={savingAll || savingSnapshotId !== null || sortedInventoryRows.length === 0}
              onClick={saveAllReorderPoints}
            >
              {savingAll ? "Saving all..." : "Save all changes"}
            </Button>
            <Button
              type="button"
              variant="outlined"
              color="secondary"
              disabled={savingAll}
              onClick={() => setSafetyPanelOpen(false)}
            >
              Close Panel
            </Button>
          </Stack>
        </CardBox>
      ) : null}
      <SimpleTable
        columns={["Body part", "Part", "Available", "Reorder Point", "Delta", "Risk"]}
        rows={sortedInventoryRows.map((r) => {
          const available = Number(r.available_qty ?? r.on_hand_qty ?? 0);
          const reorderPoint = Number(r.reorder_point_qty ?? 0);
          const delta = available - reorderPoint;
          const risk = r.risk || getInventoryRiskLevel(available, reorderPoint);
          const partLabel = r.part_detail?.part_name || r.part?.part_name || r.part || "Part";
          return [
            formatPartTypeLabel(r.part_detail?.part_type ?? inferPartTypeFromName(String(partLabel))),
            partLabel,
            available,
            reorderPoint,
            delta,
            risk,
          ];
        })}
        loading={loading}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Page>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DEFAULT_SEASONALITY_PARAMS = {
  easter_season_months: [3, 4],
  easter_season_lift_mult: 1.18,
  mega_promo_months: [1, 6],
  mega_promo_multiplier: 3,
  christmas_season_months: [11, 12],
  christmas_season_lift_mult: 1.28,
};

/** 12 bars: multiplier applied by this single event each calendar month (1 = no effect). */
function SeasonalityFactorBarChart({ values, color = primaryMain, yMax }) {
  const w = 640;
  const h = 220;
  const padX = 36;
  const padB = 36;
  const padT = 24;
  const plotH = h - padT - padB;
  const plotW = w - padX * 2;
  const barGap = 4;
  const barW = (plotW - barGap * 11) / 12;
  const maxV = yMax ?? Math.max(...values, 1.05);
  const minV = 1;
  const rng = Math.max(maxV - minV, 0.01);

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Seasonality factor by month">
        <line x1={padX} y1={padT + plotH} x2={w - padX} y2={padT + plotH} stroke="#94a3b8" />
        <line x1={padX} y1={padT} x2={padX} y2={padT + plotH} stroke="#94a3b8" />
        <text x={padX - 4} y={padT + 8} fontSize="10" fill="#64748b" textAnchor="end">
          {maxV.toFixed(2)}×
        </text>
        <text x={padX - 4} y={padT + plotH} fontSize="10" fill="#64748b" textAnchor="end">
          1×
        </text>
        {values.map((v, i) => {
          const bh = ((v - minV) / rng) * plotH;
          const x = padX + i * (barW + barGap);
          const y = padT + plotH - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(bh, 0)} fill={v > 1.001 ? color : "#e2e8f0"} rx={3} />
              <text x={x + barW / 2} y={h - 8} fontSize="11" fill="#334155" textAnchor="middle">
                {MONTH_SHORT[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

function SeasonalityEditDialog({ open, onClose, parametersUsed }) {
  const [tab, setTab] = useState(0);
  const p = { ...DEFAULT_SEASONALITY_PARAMS, ...(parametersUsed || {}) };

  useEffect(() => {
    if (open) setTab(0);
  }, [open]);

  const configs = useMemo(() => {
    const pm = Array.isArray(p.mega_promo_months) ? p.mega_promo_months : [1, 6];
    const megaMult = Number(p.mega_promo_multiplier) || 3;
    const easterMonths = new Set(Array.isArray(p.easter_season_months) ? p.easter_season_months : [3, 4]);
    const xmasMonths = new Set(Array.isArray(p.christmas_season_months) ? p.christmas_season_months : [11, 12]);
    const easterMult = Number(p.easter_season_lift_mult) || 1.18;
    const xmasMult = Number(p.christmas_season_lift_mult) || 1.28;

    const factorRow = (activeSet, mult) =>
      MONTH_SHORT.map((_, i) => {
        const m = i + 1;
        return activeSet.has(m) ? mult : 1;
      });

    const mega1Active = new Set(pm.includes(1) ? [1] : []);
    const mega2Active = new Set(pm.includes(6) ? [6] : []);

    return [
      {
        key: "easter",
        title: "Easter",
        subtitle: "Spring demand window (configurable months)",
        months: [...easterMonths].sort((a, b) => a - b),
        multiplier: easterMult,
        anchor: "Movable holiday — lift spread across Mar–Apr in parameters",
        paramRows: [
          { label: "forecast_parameters.easter_season_months", value: [...easterMonths].sort((a, b) => a - b).join(", ") },
          { label: "forecast_parameters.easter_season_lift_mult", value: String(easterMult) },
        ],
        chartValues: factorRow(easterMonths, easterMult),
        chartColor: "#ca8a04",
      },
      {
        key: "mega1",
        title: "Mega Promotion 1",
        subtitle: "January 1 promotional cycle — triple lift vs baseline",
        months: pm.includes(1) ? [1] : [],
        multiplier: megaMult,
        anchor: "January 1",
        paramRows: [
          { label: "mega_promo_months (includes 1)", value: pm.includes(1) ? "Yes" : "No — add 1 to CSV list to activate" },
          { label: "mega_promo_multiplier", value: String(megaMult) },
        ],
        chartValues: factorRow(mega1Active, megaMult),
        chartColor: "#7c3aed",
      },
      {
        key: "mega2",
        title: "Mega Promotion 2",
        subtitle: "June 1 promotional cycle — triple lift vs baseline",
        months: pm.includes(6) ? [6] : [],
        multiplier: megaMult,
        anchor: "June 1",
        paramRows: [
          { label: "mega_promo_months (includes 6)", value: pm.includes(6) ? "Yes" : "No — add 6 to CSV list to activate" },
          { label: "mega_promo_multiplier", value: String(megaMult) },
        ],
        chartValues: factorRow(mega2Active, megaMult),
        chartColor: "#9333ea",
      },
      {
        key: "christmas",
        title: "Christmas",
        subtitle: "Peak gift season (Nov–Dec by default)",
        months: [...xmasMonths].sort((a, b) => a - b),
        multiplier: xmasMult,
        anchor: "Black Friday through holiday fulfillment",
        paramRows: [
          { label: "forecast_parameters.christmas_season_months", value: [...xmasMonths].sort((a, b) => a - b).join(", ") },
          { label: "forecast_parameters.christmas_season_lift_mult", value: String(xmasMult) },
        ],
        chartValues: factorRow(xmasMonths, xmasMult),
        chartColor: "#dc2626",
      },
    ];
  }, [p]);

  const cur = configs[tab] ?? configs[0];
  const chartMax = Math.max(...cur.chartValues, cur.multiplier, 1.05);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="seasonality-edit-title">
      <DialogTitle id="seasonality-edit-title">Edit Seasonality</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review one calendar effect at a time. Values come from active <strong>Forecast parameters</strong> (re-import{" "}
          <Typography component="span" variant="body2" sx={{ fontFamily: "monospace" }}>
            forecast_parameters.csv
          </Typography>{" "}
          to change). The graph shows the <strong>factor for this event only</strong> (1× = inactive month).
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
        >
          <Tab label="Easter" id="season-tab-0" aria-controls="season-panel-0" />
          <Tab label="Mega Promotion 1" id="season-tab-1" aria-controls="season-panel-1" />
          <Tab label="Mega Promotion 2" id="season-tab-2" aria-controls="season-panel-2" />
          <Tab label="Christmas" id="season-tab-3" aria-controls="season-panel-3" />
        </Tabs>
        <Stack spacing={2} role="tabpanel" id={`season-panel-${tab}`} aria-labelledby={`season-tab-${tab}`}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {cur.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cur.subtitle}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Planning anchor: {cur.anchor}
            </Typography>
          </Box>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "#fafbfc" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Specifications
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: "40%" }}>Active months (calendar)</TableCell>
                  <TableCell>
                    {cur.months.length ? cur.months.map((m) => `${MONTH_SHORT[m - 1]} (${m})`).join(", ") : "— (none configured)"}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Demand multiplier</TableCell>
                  <TableCell>
                    ×{cur.multiplier} on active months (multiplies baseline doll forecast after prior factors in pipeline)
                  </TableCell>
                </TableRow>
                {cur.paramRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{row.label}</TableCell>
                    <TableCell sx={{ fontSize: "0.85rem" }}>{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Factor by calendar month (this event only)
            </Typography>
            <SeasonalityFactorBarChart values={cur.chartValues} color={cur.chartColor} yMax={chartMax} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Forecasting() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");
  const [reloadKey, setReloadKey] = useState(0);
  const [seasonalityOpen, setSeasonalityOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getDemandForecastWorkbench()
      .then((payload) => {
        setData(payload);
        setSource("live");
      })
      .catch(() => {
        setData(null);
        setSource("mock");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const histLabels = useMemo(
    () => (data?.history ?? []).map((h) => h.year_month?.slice(2) ?? ""),
    [data]
  );
  const histValues = useMemo(() => (data?.history ?? []).map((h) => h.units_sold ?? 0), [data]);
  const fcLabels = useMemo(
    () => (data?.forecast ?? []).map((f) => f.year_month?.slice(2) ?? ""),
    [data]
  );
  const fcValues = useMemo(() => (data?.forecast ?? []).map((f) => f.doll_units_forecast ?? 0), [data]);

  const promoMonths = data?.parameters_used?.mega_promo_months ?? [1, 6];
  const paramMult = data?.parameters_used?.mega_promo_multiplier ?? 3;

  return (
    <Page
      title="Forecasting Workbench"
      subtitle="Predict future demand from completed doll unit sales, seasonal lifts (Christmas, Easter), mega promos (Jan & Jun), and BOM-based order recommendations."
    >
      {source === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Forecast workbench API unavailable. Start the Django server and run{" "}
          <code>python manage.py import_doll_sales_from_data</code> (plus seed forecast parameters).
        </Alert>
      ) : null}
      <SeasonalityEditDialog
        open={seasonalityOpen}
        onClose={() => setSeasonalityOpen(false)}
        parametersUsed={data?.parameters_used}
      />
      <ActionRow
        actions={[
          { label: "Recalculate Forecast", onClick: () => setReloadKey((k) => k + 1) },
          { label: "Train Model", variant: "outlined" },
          { label: "Compare Models", variant: "outlined" },
          { label: "Edit Seasonality", variant: "outlined", onClick: () => setSeasonalityOpen(true) },
        ]}
      />

      <CardBox title="Purpose">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Uses <strong>past complete doll unit sales</strong> (one row per month) to project the next 12 months. Applies{" "}
          <strong>Christmas</strong> and <strong>Easter</strong> seasonal multipliers, then <strong>two mega promotionals per year</strong>{" "}
          (months {promoMonths.join(" & ")}, ×{paramMult} sales) aligned with <strong>June 1</strong> and <strong>January 1</strong> planning
          cycles. Demand is <strong>exploded into parts</strong> via a standard BOM (2 arms, 2 legs, 1 head, hair, 2 eyes, torso, box per doll) with
          SKU-level split within each part type. <strong>Recommended order qty</strong> = next-month need + safety stock − available inventory.
        </Typography>
        {data?.methodology ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {data.methodology}
          </Typography>
        ) : null}
      </CardBox>

      {data?.parameters_used ? (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2, gap: 1 }}>
          <Chip size="small" color="error" label={`Christmas lift ×${data.parameters_used.christmas_season_lift_mult}`} variant="outlined" />
          <Chip size="small" color="warning" label={`Easter lift ×${data.parameters_used.easter_season_lift_mult}`} variant="outlined" />
          <Chip
            size="small"
            color="secondary"
            label={`Mega promo ×${data.parameters_used.mega_promo_multiplier} (months ${(data.parameters_used.mega_promo_months ?? []).join(", ")})`}
            variant="outlined"
          />
          <Chip size="small" label={`Horizon doll units: ${data.horizon_doll_units_total?.toLocaleString?.() ?? data.horizon_doll_units_total}`} />
        </Stack>
      ) : null}

      {loading ? (
        <Skeleton variant="rounded" height={220} sx={{ mb: 2 }} />
      ) : data?.error === "no_history" ? (
        <Alert severity="info">{data.message}</Alert>
      ) : (
        <Grid container spacing={2.5} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <CardBox title="History — complete doll units sold">
              <MiniLineChart
                labels={histLabels}
                values={histValues.length ? histValues : [0]}
                color="#2563eb"
                yLabel="Number of dolls"
                yValueUnit=" dolls"
                chipLabel="Actual doll units / month"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Last month in file: <strong>{data?.last_actual_month ?? "—"}</strong> · Baseline (avg last 3):{" "}
                <strong>{data?.baseline_avg_last_3_months ?? "—"}</strong> dolls/mo
              </Typography>
            </CardBox>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <CardBox title="Forecast — adjusted doll orders (next 12 months)">
              <MiniLineChart
                labels={fcLabels}
                values={fcValues.length ? fcValues : [0]}
                color={primaryMain}
                yLabel="Number of dolls"
                yValueUnit=" dolls"
                chipLabel="Forecast doll units / month"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Peaks include Nov–Dec Christmas, Mar–Apr Easter, and ×{paramMult} in Jan & Jun promo months.
              </Typography>
            </CardBox>
          </Grid>
        </Grid>
      )}

      {!loading && data?.forecast?.length ? (
        <CardBox title="Forecast detail (multipliers)">
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Doll units
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    × Combined
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    Christmas
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    Easter
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    Mega promo
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.forecast.map((row) => (
                  <TableRow key={row.year_month} hover>
                    <TableCell>{row.year_month}</TableCell>
                    <TableCell align="right">{row.doll_units_forecast}</TableCell>
                    <TableCell align="right">{row.combined_multiplier}</TableCell>
                    <TableCell>{row.factors?.christmas_lift ? "Yes" : "—"}</TableCell>
                    <TableCell>{row.factors?.easter_lift ? "Yes" : "—"}</TableCell>
                    <TableCell>{row.factors?.mega_promo_jan_or_jun ? `×${paramMult}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardBox>
      ) : null}

      {!loading && data?.parts_plan?.length ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Parts plan & recommended orders (next month, per SKU)
          </Typography>
          <SimpleTable
            columns={[
              "Part type",
              "SKU",
              "Part name",
              "Qty / doll",
              "Next mo need",
              "Available",
              "Safety",
              "Recommend buy",
            ]}
            rows={data.parts_plan.map((p) => [
              formatPartTypeLabel(p.part_type),
              p.part_number,
              p.part_name,
              String(p.qty_per_doll),
              p.next_month_part_demand,
              p.available_qty,
              p.safety_stock_qty,
              p.recommended_order_qty,
            ])}
            loading={false}
          />
        </Box>
      ) : null}
    </Page>
  );
}

function Orders() {
  const { operational, operationalLoading, operationalSource, mergedParameterMap } = useOperationalWorkbench();

  const base = operational ?? MOCK_OPERATIONAL;
  const hasLiveDaily = (operational?.daily_operations?.length ?? 0) > 0;
  const hasLiveWeekly = (operational?.weekly_operations?.length ?? 0) > 0;
  const daily = hasLiveDaily ? operational.daily_operations.slice(-14) : MOCK_OPERATIONAL.daily_operations;
  const weekly = hasLiveWeekly ? operational.weekly_operations.slice(-8) : MOCK_OPERATIONAL.weekly_operations;

  const summary = base.orders_summary ?? MOCK_OPERATIONAL.orders_summary;
  const shipHours = mergedParameterMap.ship_within_hours ?? summary.ship_within_hours ?? 48;
  const shipTarget = mergedParameterMap.on_time_ship_target ?? summary.on_time_ship_target ?? 0.98;
  const rate = summary.on_time_48h_rate ?? 0;
  const keepingUp = rate >= shipTarget - 0.005;

  const dailyLabels = useMemo(() => daily.map((d) => d.target_date?.slice(5) ?? ""), [daily]);
  const shipActual = useMemo(() => daily.map((d) => d.actual_shipped ?? 0), [daily]);
  const shipTargetSeries = useMemo(() => daily.map((d) => d.target_shipped ?? 0), [daily]);
  const backlogSeries = useMemo(() => daily.map((d) => d.backlog_qty ?? 0), [daily]);

  const weeklyRows = useMemo(
    () =>
      weekly.map((w) => {
        const ach = w.target_shipped ? Math.round((100 * (w.actual_shipped || 0)) / w.target_shipped) : "—";
        const otr = w.on_time_ship_rate != null ? `${(Number(w.on_time_ship_rate) * 100).toFixed(1)}%` : "—";
        return [
          `${w.week_start?.slice(5) ?? ""} – ${w.week_end?.slice(5) ?? ""}`,
          w.target_orders ?? "—",
          w.actual_orders ?? "—",
          w.actual_assembled ?? "—",
          w.actual_shipped ?? "—",
          `${ach}%`,
          otr,
          w.ending_backlog ?? "—",
        ];
      }),
    [weekly]
  );

  const defaultPlanBacklog = Number(summary.latest_backlog) || 0;
  const defaultPlanNewOrders = Number(daily[daily.length - 1]?.actual_orders) || 0;
  const [planBacklogStr, setPlanBacklogStr] = useState("");
  const [planNewOrdersStr, setPlanNewOrdersStr] = useState("");
  const [planGeneratedAt, setPlanGeneratedAt] = useState(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [ordersPlanSnack, setOrdersPlanSnack] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    setPlanBacklogStr(String(defaultPlanBacklog));
    setPlanNewOrdersStr(String(defaultPlanNewOrders));
  }, [defaultPlanBacklog, defaultPlanNewOrders]);

  const planBacklogQty = Math.max(0, Math.round(parseFloat(planBacklogStr) || 0));
  const planNewOrdersQty = Math.max(0, Math.round(parseFloat(planNewOrdersStr) || 0));
  const planTotalDolls = planBacklogQty + planNewOrdersQty;
  const productionPlan = useMemo(() => buildEvenTeamShiftPlan(planTotalDolls), [planTotalDolls]);
  const fulfillmentCheckpoints = useMemo(() => buildFulfillmentCheckpointRows(planTotalDolls), [planTotalDolls]);
  const maxCellQty = useMemo(
    () => Math.max(1, ...productionPlan.rows.flatMap((r) => r.cells.map((c) => c.qty))),
    [productionPlan.rows]
  );
  const maxCheckpointQty = useMemo(
    () => Math.max(1, planTotalDolls, ...fulfillmentCheckpoints.flatMap((r) => [r.completed, r.boxed, r.dispatched])),
    [fulfillmentCheckpoints, planTotalDolls]
  );

  const regenerateProductionPlan = () => {
    setPlanGeneratedAt(new Date());
  };

  const planDateLabel = daily.length ? daily[daily.length - 1]?.target_date ?? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const dailyPlanExportOpts = useMemo(
    () => ({
      planDateLabel,
      planTotalDolls,
      planBacklogQty,
      planNewOrdersQty,
      productionPlan,
      fulfillmentCheckpoints,
      shipHours,
    }),
    [planDateLabel, planTotalDolls, planBacklogQty, planNewOrdersQty, productionPlan, fulfillmentCheckpoints, shipHours]
  );

  const openDailyPlanPrintPreview = () => {
    const ok = openDailyPlanFormWindow(dailyPlanExportOpts);
    if (!ok) {
      setOrdersPlanSnack({
        open: true,
        severity: "warning",
        message: "Could not open print preview. Allow pop-ups for this site and try again.",
      });
    }
  };

  const exportDailyPlan = async () => {
    setPdfExporting(true);
    try {
      await downloadDailyPlanPdf(dailyPlanExportOpts);
      const rawLabel = String(planDateLabel || "plan").replace(/[/\\?%*:|"<>]/g, "-");
      setOrdersPlanSnack({
        open: true,
        message: `Downloaded OptiDoll-Daily-Plan-${rawLabel}.pdf`,
        severity: "success",
      });
    } catch (e) {
      const opened = openDailyPlanFormWindow(dailyPlanExportOpts);
      setOrdersPlanSnack({
        open: true,
        severity: opened ? "warning" : "error",
        message: opened
          ? "PDF export failed; opened a print-friendly tab — use Print → Save as PDF."
          : `${e?.message || "PDF export failed."} Allow downloads, relax strict blockers, allow pop-ups, then try again.`,
      });
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <Page
      title="Orders & Targets"
      subtitle={
        base.purpose?.orders ??
        "Track daily and weekly performance: orders received, assembled, shipped, 48-hour ship goal, backlog, and whether operations are keeping up."
      }
    >
      {operationalSource === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Operational workbench API unavailable. Showing embedded demo series; connect Django and run seed import for live daily/weekly targets.
        </Alert>
      ) : null}
      {operationalSource === "live" && !operationalLoading && !hasLiveDaily ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No daily targets in the database yet. Import seed data (includes <code>daily_targets.csv</code>) to populate charts; demo series is shown until then.
        </Alert>
      ) : null}

      <CardBox title="Purpose">
        <Typography variant="body2" color="text.secondary">
          Shows orders received, assembled, and shipped; tracks the {shipHours}-hour shipping goal against Settings; compares daily and weekly targets to
          actuals; monitors backlog.{" "}
          <strong>{keepingUp ? "Operations are at or above the ship target." : "Operations are slightly below the ship target — review capacity and backlog."}</strong>
        </Typography>
      </CardBox>

      <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title={`${shipHours}h ship rate`}
            value={`${(rate * 100).toFixed(1)}%`}
            subtitle={`Target: ${(shipTarget * 100).toFixed(0)}% (Settings)`}
            color={rate >= shipTarget ? "success" : "warning"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Latest backlog" value={summary.latest_backlog ?? "—"} subtitle="End of last reported day" color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Orders in system" value={summary.total_orders ?? "—"} subtitle={`Shipped: ${summary.shipped_orders ?? "—"}`} color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Weekly ship attainment"
            value={weekly.length ? `${Math.round((100 * (weekly[weekly.length - 1].actual_shipped || 0)) / Math.max(weekly[weekly.length - 1].target_shipped || 1, 1))}%` : "—"}
            subtitle="Most recent week vs ship target"
            color="primary"
          />
        </Grid>
      </Grid>

      <ActionRow
        actions={[
          { label: "Generate Order Plan", variant: "contained", color: "secondary", onClick: regenerateProductionPlan },
          {
            label: "Export Daily Plan",
            variant: "outlined",
            color: "secondary",
            onClick: exportDailyPlan,
            loading: pdfExporting,
            loadingLabel: "Building PDF…",
          },
          {
            label: "Print preview",
            variant: "text",
            color: "secondary",
            onClick: openDailyPlanPrintPreview,
            disabled: pdfExporting,
          },
          { label: "Approve Order", variant: "contained", color: "success" },
          { label: "Review Risk", variant: "contained", color: "warning" },
        ]}
      />

      <CardBox title="Production build plan — 4 teams × Day / Night shifts">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Doll builds to clear <strong>backlog</strong> and cover <strong>new orders</strong> are split across four production teams and two shifts per team.
          Quantities use an <strong>even distribution</strong>: each team-shift block gets ⌊total÷8⌋ or ⌈total÷8⌉ dolls so no block differs by more than one unit from any other.
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Backlog dolls to clear"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={planBacklogStr}
              onChange={(e) => setPlanBacklogStr(e.target.value)}
              helperText={`Default: latest backlog (${defaultPlanBacklog})`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="New order dolls (intake to fulfill)"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={planNewOrdersStr}
              onChange={(e) => setPlanNewOrdersStr(e.target.value)}
              helperText={`Default: most recent day orders received (${defaultPlanNewOrders})`}
            />
          </Grid>
        </Grid>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Chip color="secondary" label={`Total dolls in plan: ${planTotalDolls.toLocaleString()}`} />
          <Chip variant="outlined" label={`Base per block: ${productionPlan.base} · +1 blocks: ${productionPlan.remainder}`} />
          {planGeneratedAt ? (
            <Typography variant="caption" color="text.secondary">
              Plan refreshed {planGeneratedAt.toLocaleTimeString()}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Click Generate Order Plan to timestamp a refresh.
            </Typography>
          )}
        </Stack>
        {planTotalDolls === 0 ? (
          <Alert severity="info">Enter a backlog and/or new-order quantity above to see the team × shift grid.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Production team</TableCell>
                  {PRODUCTION_SHIFTS.map((s) => (
                    <TableCell key={s.key} align="center" sx={{ fontWeight: 700 }}>
                      {s.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Row total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {productionPlan.rows.map((row) => (
                  <TableRow key={row.teamLabel}>
                    <TableCell>{row.teamLabel}</TableCell>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.shiftKey} align="center">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {cell.qty.toLocaleString()}
                        </Typography>
                        <Box sx={{ height: 6, borderRadius: 1, bgcolor: "#e2e8f0", mt: 0.75, maxWidth: 120, mx: "auto" }}>
                          <Box
                            sx={{
                              height: "100%",
                              width: `${(cell.qty / maxCellQty) * 100}%`,
                              bgcolor: primaryMain,
                              borderRadius: 1,
                              minWidth: cell.qty > 0 ? 4 : 0,
                            }}
                          />
                        </Box>
                      </TableCell>
                    ))}
                    <TableCell align="right">{row.rowSum.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: "rgba(133, 116, 196, 0.08)" }}>
                  <TableCell sx={{ fontWeight: 700 }}>Shift totals</TableCell>
                  {productionPlan.shiftColumnTotals.map((t, i) => (
                    <TableCell key={PRODUCTION_SHIFTS[i].key} align="center" sx={{ fontWeight: 700 }}>
                      {t.toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {planTotalDolls.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {planTotalDolls > 0 ? (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
              Intra-day fulfillment — completed, boxed, dispatch to shipping partner
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Cumulative doll targets by wall-clock time for the same plan total ({planTotalDolls.toLocaleString()} dolls). Schedule assumes a{" "}
              <strong>8:00 AM–5:00 PM</strong> operating day with steady output. Boxing trails assembly and handoff to the shipping partner trails boxing
              (short pipeline lag so counts stay realistic through mid-day).
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Dolls completed (assembly)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Dolls boxed
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Dolls dispatched to shipping partner
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Day progress
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fulfillmentCheckpoints.map((row) => (
                    <TableRow key={row.timeLabel}>
                      <TableCell sx={{ fontWeight: 600 }}>{row.timeLabel}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.completed.toLocaleString()}
                        </Typography>
                        <Box sx={{ height: 4, borderRadius: 1, bgcolor: "#e2e8f0", mt: 0.5, maxWidth: 100, ml: "auto" }}>
                          <Box sx={{ width: `${(row.completed / maxCheckpointQty) * 100}%`, height: "100%", bgcolor: "#2563eb", borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.boxed.toLocaleString()}
                        </Typography>
                        <Box sx={{ height: 4, borderRadius: 1, bgcolor: "#e2e8f0", mt: 0.5, maxWidth: 100, ml: "auto" }}>
                          <Box sx={{ width: `${(row.boxed / maxCheckpointQty) * 100}%`, height: "100%", bgcolor: "#7c3aed", borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.dispatched.toLocaleString()}
                        </Typography>
                        <Box sx={{ height: 4, borderRadius: 1, bgcolor: "#e2e8f0", mt: 0.5, maxWidth: 100, ml: "auto" }}>
                          <Box sx={{ width: `${(row.dispatched / maxCheckpointQty) * 100}%`, height: "100%", bgcolor: "#047857", borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                      <TableCell align="center">{row.dayProgressPct}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "rgba(37, 99, 235, 0.06)" }}>
                    <TableCell sx={{ fontWeight: 700 }}>End of day (plan)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {planTotalDolls.toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {planTotalDolls.toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {planTotalDolls.toLocaleString()}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      100%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : null}
      </CardBox>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <CardBox title="Daily shipped vs target (last 14 days)">
            <MiniLineChart
              labels={dailyLabels.length ? dailyLabels : ["—"]}
              values={shipActual.length ? shipActual : [0]}
              color="#2563eb"
              yLabel="Units"
              yValueUnit=" units"
              chipLabel="Actual shipped / day"
            />
          </CardBox>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <CardBox title="Daily ship target (plan)">
            <MiniLineChart
              labels={dailyLabels.length ? dailyLabels : ["—"]}
              values={shipTargetSeries.length ? shipTargetSeries : [0]}
              color="#64748b"
              yLabel="Units"
              yValueUnit=" units"
              chipLabel="Target shipped / day"
            />
          </CardBox>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <CardBox title="Backlog trend (end of day)">
            <MiniLineChart
              labels={dailyLabels.length ? dailyLabels : ["—"]}
              values={backlogSeries.length ? backlogSeries : [0]}
              color="#b45309"
              yLabel="Backlog units"
              yValueUnit=" units"
              chipLabel="Backlog EOD"
            />
          </CardBox>
        </Grid>
      </Grid>

      <CardBox title="Weekly performance vs targets">
        <SimpleTable
          columns={["Week", "Target orders", "Received", "Assembled", "Shipped (48h window)", "Ship attainment", "On-time rate", "Ending backlog"]}
          rows={weeklyRows}
          loading={operationalLoading}
        />
      </CardBox>

      <Snackbar
        open={ordersPlanSnack.open}
        autoHideDuration={6500}
        onClose={() => setOrdersPlanSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={ordersPlanSnack.severity} onClose={() => setOrdersPlanSnack((s) => ({ ...s, open: false }))} sx={{ width: "100%" }}>
          {ordersPlanSnack.message}
        </Alert>
      </Snackbar>
    </Page>
  );
}

/** Target supply base shown on Supplier Risk (by body group). Same names as seed SUP_RISK_* vendors. */
const SUPPLIER_RISK_BY_CATEGORY = [
  {
    label: "Arm",
    suppliers: [
      { name: "HiSu", country: "China" },
      { name: "IndiaSilicone", country: "India" },
    ],
  },
  {
    label: "Eyes",
    suppliers: [
      { name: "EyeSan", country: "Japan" },
      { name: "E-Toys", country: "Pakistan" },
      { name: "BeautyEyes", country: "Canada" },
      { name: "IrisStyles", country: "USA" },
    ],
  },
  {
    label: "Head",
    suppliers: [
      { name: "SilicaForms", country: "UK" },
      { name: "E-Toys", country: "Pakistan" },
    ],
  },
  {
    label: "Leg",
    suppliers: [
      { name: "HiSu", country: "China" },
      { name: "IndiaSilicone", country: "India" },
      { name: "E-Toys", country: "Pakistan" },
    ],
  },
  {
    label: "Hair",
    suppliers: [
      { name: "PolySyth", country: "Indonesia" },
      { name: "HairySan", country: "Japan" },
      { name: "HiSu", country: "China" },
      { name: "E-Toys", country: "Pakistan" },
    ],
  },
  {
    label: "Torso",
    suppliers: [{ name: "SoftBody", country: "USA" }],
  },
  {
    label: "Box",
    suppliers: [
      { name: "BoxingDay", country: "UK" },
      { name: "CanadaContainers", country: "Canada" },
      { name: "BoXy", country: "USA" },
      { name: "BoxMe", country: "USA" },
    ],
  },
];

function uniqueSupplierRiskMockTableRows() {
  const seen = new Set();
  const out = [];
  for (const cat of SUPPLIER_RISK_BY_CATEGORY) {
    for (const s of cat.suppliers) {
      const key = `${s.name}|${s.country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([s.name, s.country, "Current", "Review", "Review"]);
    }
  }
  return out;
}

function Suppliers() {
  const [rows, setRows] = useState([]);
  const [partLinks, setPartLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");
  const [compareOpen, setCompareOpen] = useState(false);
  const [frequentOpen, setFrequentOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  const refreshSupplierData = useCallback(async () => {
    try {
      const [suppliersData, linksData] = await Promise.all([getSuppliers(), getSupplierParts()]);
      setRows(suppliersData.results || suppliersData);
      const rawLinks = linksData.results || linksData;
      setPartLinks(Array.isArray(rawLinks) ? [...rawLinks].sort(compareSupplierPartLinks) : []);
      setSource("live");
    } catch {
      setRows(uniqueSupplierRiskMockTableRows());
      setPartLinks([]);
      setSource("mock");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getSuppliers(), getSupplierParts()])
      .then(([suppliersData, linksData]) => {
        if (cancelled) return;
        setRows(suppliersData.results || suppliersData);
        const rawLinks = linksData.results || linksData;
        setPartLinks(Array.isArray(rawLinks) ? [...rawLinks].sort(compareSupplierPartLinks) : []);
        setSource("live");
      })
      .catch(() => {
        if (cancelled) return;
        setRows(uniqueSupplierRiskMockTableRows());
        setPartLinks([]);
        setSource("mock");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const linksBySupplierId = useMemo(() => {
    const m = new Map();
    for (const l of partLinks) {
      const id = l.supplier;
      if (id == null) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(l);
    }
    return m;
  }, [partLinks]);

  const allSuppliersTableRows = useMemo(() => {
    if (!rows.length) return [];
    if (Array.isArray(rows[0])) return rows;
    return rows.map((s) => {
      const links = linksBySupplierId.get(s.id) ?? [];
      const leadCell = source === "live" ? leadTimeRiskReviewCell(links) : "Review";
      const tariffCell = source === "live" ? tariffRiskReviewCell(links) : "Review";
      return [s.supplier_name, s.country, s.cpsia_current ? "Current" : "Review", leadCell, tariffCell];
    });
  }, [rows, linksBySupplierId, source]);

  return (
    <Page title="Supplier Risk" subtitle="Assess continuity risk, compliance posture, and backup options.">
      <SupplierCompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        source={source}
        suppliers={Array.isArray(rows[0]) ? [] : rows}
        linksBySupplierId={linksBySupplierId}
      />
      <FrequentSupplierDialog open={frequentOpen} onClose={() => setFrequentOpen(false)} />
      <AddBackupSupplierDialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onCreated={refreshSupplierData}
        source={source}
      />
      {source === "mock" ? <Alert severity="warning" sx={{ mb: 2 }}>Suppliers API unavailable. Showing fallback vendors.</Alert> : null}
      <ActionRow
        actions={[
          { label: "Compare Suppliers", onClick: () => setCompareOpen(true) },
          { label: "Frequent Supplier", onClick: () => setFrequentOpen(true) },
          { label: "Add Backup Supplier", onClick: () => setBackupOpen(true) },
        ]}
      />
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
        Supply base by category
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {SUPPLIER_RISK_BY_CATEGORY.map((cat) => (
          <Grid key={cat.label} size={{ xs: 12, sm: 6, md: 4 }}>
            <CardBox
              title={`${cat.label} ${cat.label === "Torso" ? "Supplier" : "Suppliers"}`}
            >
              <Stack component="ul" sx={{ m: 0, pl: 2.25, typography: "body2" }}>
                {cat.suppliers.map((s) => (
                  <li key={`${cat.label}-${s.name}-${s.country}`}>
                    <strong>{s.name}</strong>
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                      · {s.country}
                    </Typography>
                  </li>
                ))}
              </Stack>
            </CardBox>
          </Grid>
        ))}
      </Grid>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
        All Suppliers (API)
      </Typography>
      <SimpleTable
        columns={["Supplier", "Country", "Certification", "Lead Time Risk", "Tariff Risk"]}
        rows={allSuppliersTableRows}
        loading={loading}
      />
      {source === "live" && partLinks.length > 0 ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            Parts by body group (alphabetical within each type)
          </Typography>
          <SimpleTable
            columns={["Body part", "Part", "Supplier", "Country", "Primary"]}
            rows={partLinks.map((l) => [
              formatPartTypeLabel(l.part_detail?.part_type),
              l.part_detail?.part_name ?? "—",
              l.supplier_detail?.supplier_name ?? "—",
              l.supplier_detail?.country ?? "—",
              l.is_primary ? "Yes" : "No",
            ])}
            loading={loading}
          />
        </Box>
      ) : null}
    </Page>
  );
}

function LogDefectDialog({ open, onClose, defectTypes, onSaved }) {
  const [defectTypeId, setDefectTypeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [defectDate, setDefectDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [severity, setSeverity] = useState("minor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (defectTypes?.length) {
      setDefectTypeId((prev) => prev || String(defectTypes[0].id));
    }
  }, [open, defectTypes]);

  const save = async () => {
    if (!defectTypes?.length) {
      setError("No defect types available from the server. Import seed data or add defect types in admin.");
      return;
    }
    if (!defectTypeId) {
      setError("Select a defect type.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createDefectEvent({
        defect_date: defectDate,
        defect_type: Number(defectTypeId),
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        severity,
        notes: notes.trim() || "",
      });
      onSaved?.();
      onClose();
    } catch (e) {
      const detail = e?.response?.data;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.detail
            ? String(detail.detail)
            : Array.isArray(detail)
              ? JSON.stringify(detail)
              : detail
                ? JSON.stringify(detail)
                : e?.message;
      setError(msg || "Could not save defect.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Log defect</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="defect-type-lbl">Defect type</InputLabel>
            <Select
              labelId="defect-type-lbl"
              label="Defect type"
              value={defectTypeId}
              onChange={(e) => setDefectTypeId(e.target.value)}
            >
              {(defectTypes ?? []).map((dt) => (
                <MenuItem key={dt.id} value={String(dt.id)}>
                  {dt.defect_name} ({dt.defect_code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Defect date"
            type="date"
            value={defectDate}
            onChange={(e) => setDefectDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField size="small" label="Quantity" type="number" inputProps={{ min: 1 }} value={quantity} onChange={(e) => setQuantity(e.target.value)} fullWidth />
          <FormControl fullWidth size="small">
            <InputLabel id="sev-lbl">Severity</InputLabel>
            <Select labelId="sev-lbl" label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <MenuItem value="minor">Minor</MenuItem>
              <MenuItem value="major">Major</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" label="Notes (misbuild details, order ref, etc.)" multiline minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !(defectTypes?.length > 0)}>
          {saving ? "Saving…" : "Save to defect log"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CapaCaseDialog({ open, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle("");
    setProblem("");
    setDueDate("");
  }, [open]);

  const save = async () => {
    if (!title.trim() || !problem.trim()) {
      setError("Title and problem statement are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const opened_date = new Date().toISOString().slice(0, 10);
    const capa_number = `WEB-${Date.now()}`;
    try {
      const payload = {
        capa_number,
        opened_date,
        title: title.trim(),
        problem_statement: problem.trim(),
        status: "open",
      };
      if (dueDate) payload.due_date = dueDate;
      await createCapaCase(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      const detail = e?.response?.data;
      const msg = typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : e?.message;
      setError(msg || "Could not create CAPA.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Open CAPA case</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Creates a corrective/preventive action record via the API. Follow up in the CAPA tracker below.
          </Typography>
          <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth required />
          <TextField
            size="small"
            label="Problem statement"
            multiline
            minRows={4}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            fullWidth
            required
          />
          <TextField size="small" label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="secondary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Create CAPA"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Quality() {
  const [defects, setDefects] = useState([]);
  const [defectsLoading, setDefectsLoading] = useState(true);
  const [defectsSource, setDefectsSource] = useState("live");
  const [logDefectOpen, setLogDefectOpen] = useState(false);
  const [capaOpen, setCapaOpen] = useState(false);
  const [capaFilter, setCapaFilter] = useState("all");
  const [spcSnack, setSpcSnack] = useState(false);
  const paretoRef = useRef(null);
  const capaRef = useRef(null);
  const { operational, operationalLoading, operationalSource, mergedParameterMap, reloadOperational } = useOperationalWorkbench();

  const refreshDefects = useCallback(() => {
    setDefectsLoading(true);
    getDefects()
      .then((data) => {
        setDefects(data.results || data);
        setDefectsSource("live");
      })
      .catch(() => {
        setDefects([]);
        setDefectsSource("mock");
      })
      .finally(() => setDefectsLoading(false));
  }, []);

  useEffect(() => {
    refreshDefects();
  }, [refreshDefects]);

  const afterMutation = useCallback(() => {
    reloadOperational();
    refreshDefects();
  }, [reloadOperational, refreshDefects]);

  const sortedDefects = useMemo(() => {
    if (!defects.length || Array.isArray(defects[0])) return defects;
    return [...defects].sort(compareDefectRecords);
  }, [defects]);

  const q = operational?.quality ?? MOCK_OPERATIONAL.quality;
  const defectTypes = q.defect_types ?? MOCK_OPERATIONAL.quality.defect_types ?? [];
  const copqBreakdown = q.copq_breakdown ?? MOCK_OPERATIONAL.quality.copq_breakdown;
  const capaSummary = q.capa_summary ?? MOCK_OPERATIONAL.quality.capa_summary;
  const defectTrend = (q.defect_monthly_trend ?? MOCK_OPERATIONAL.quality.defect_monthly_trend ?? []).slice(-12);
  const dpmoBasis = q.dpmo_basis ?? MOCK_OPERATIONAL.quality.dpmo_basis;

  const paretoLabels = useMemo(() => (q.pareto ?? []).map((p) => p.label), [q.pareto]);
  const paretoValues = useMemo(() => (q.pareto ?? []).map((p) => p.count), [q.pareto]);
  const paretoThreshold = paretoValues.length ? Math.max(10, Math.round(0.35 * Math.max(...paretoValues))) : 10;

  const rootLabels = useMemo(() => (q.root_causes ?? []).map((r) => r.label), [q.root_causes]);
  const rootValues = useMemo(() => (q.root_causes ?? []).map((r) => r.count), [q.root_causes]);

  const trendLabels = useMemo(() => defectTrend.map((t) => t.year_month?.replace(/^(\d{4})-(\d{2})$/, "$2/$1") ?? ""), [defectTrend]);
  const trendValues = useMemo(() => defectTrend.map((t) => t.defect_units ?? 0), [defectTrend]);

  const dpmoTarget = mergedParameterMap.dpmo_target ?? q.dpmo_target ?? 3400;
  const rtyTarget = mergedParameterMap.target_rty ?? q.rty_target ?? 0.95;
  const confTarget = mergedParameterMap.configuration_accuracy_target ?? q.configuration_accuracy_target ?? 0.99;
  const cpkTarget = mergedParameterMap.min_cpk ?? q.cpk_target ?? 1.33;

  const capaList = operational?.capa?.length ? operational.capa : MOCK_OPERATIONAL.capa;
  const filteredCapa = useMemo(() => {
    if (capaFilter === "all") return capaList;
    return capaList.filter((c) => (c.status || "").toLowerCase() === capaFilter);
  }, [capaList, capaFilter]);

  const dpmoVal = Math.max(1, Math.round(q.dpmo ?? 0));
  const dpmoVsTargetPct = Math.min(100, Math.round((dpmoTarget / dpmoVal) * 100));

  const copqLines = copqBreakdown?.quality_cost_lines ?? {};
  const copqRows = [
    ["Scrap", `$${Math.round(copqLines.scrap ?? 0).toLocaleString()}`],
    ["Rework", `$${Math.round(copqLines.rework ?? 0).toLocaleString()}`],
    ["Returns (quality cost records)", `$${Math.round(copqLines.return_cost ?? 0).toLocaleString()}`],
    ["Warranty", `$${Math.round(copqLines.warranty ?? 0).toLocaleString()}`],
    ["Expedite", `$${Math.round(copqLines.expedite ?? 0).toLocaleString()}`],
    ["Subtotal (quality cost table)", `$${Math.round(copqBreakdown?.quality_costs_recorded ?? 0).toLocaleString()}`],
    ["Returns / rework / refunds (return events)", `$${Math.round(copqBreakdown?.returns_and_rework_charges ?? 0).toLocaleString()}`],
    ["Combined (90 days)", `$${Math.round(copqBreakdown?.combined_90d ?? q.copq_total_90d ?? 0).toLocaleString()}`],
  ];

  const scrollToPareto = () => paretoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToCapa = () => capaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Page
      title="Quality / Six Sigma"
      subtitle={
        operational?.purpose?.quality ??
        "Monitor and improve product quality. Tracks defects (wrong assembly, damage, etc.), calculates metrics like DPMO and yield, shows root causes of problems, manages CAPA (corrective actions), and tracks cost of poor quality. Helps reduce mistakes and improve consistency."
      }
    >
      <LogDefectDialog open={logDefectOpen} onClose={() => setLogDefectOpen(false)} defectTypes={defectTypes} onSaved={afterMutation} />
      <CapaCaseDialog open={capaOpen} onClose={() => setCapaOpen(false)} onSaved={afterMutation} />
      <Snackbar open={spcSnack} autoHideDuration={2800} onClose={() => setSpcSnack(false)} message="SPC refresh queued — metrics recalculated from latest operational snapshot." />

      {operationalSource === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Operational workbench API unavailable. Showing embedded demo quality data; Log defect / CAPA still call the API when the server is up.
        </Alert>
      ) : null}
      {defectsSource === "mock" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Defects API unreachable — event log may be empty. Charts and pareto still reflect the operational workbench (and seed/CSV fallbacks on the server).
        </Alert>
      ) : null}

      <CardBox title="Purpose">
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
          {`Monitor and improve product quality.

Tracks defects (wrong assembly, damage, etc.).
Calculates metrics like DPMO and yield.
Shows root causes of problems.
Manages CAPA (corrective actions).
Tracks cost of poor quality.

Helps reduce mistakes and improve consistency.`}
        </Typography>
      </CardBox>

      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="DPMO (est.)" value={Math.round(q.dpmo ?? 0).toLocaleString()} subtitle={`Target ≤ ${Math.round(dpmoTarget).toLocaleString()}`} color="warning" />
          <Box sx={{ mt: 1, px: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Closer to 100% = nearer DPMO target (lower DPMO is better)
            </Typography>
            <LinearProgress variant="determinate" value={dpmoVsTargetPct} sx={{ mt: 0.5, height: 8, borderRadius: 1 }} color={dpmoVal <= dpmoTarget ? "success" : "warning"} />
          </Box>
          {dpmoBasis ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Basis: {dpmoBasis.defect_units} defect units ÷ ({dpmoBasis.units_for_dpmo ?? dpmoBasis.order_count} doll-unit basis ×{" "}
              {dpmoBasis.opportunities_per_unit} opp)
              {dpmoBasis.recent_throughput_units != null
                ? ` · last-14d throughput sum ${Number(dpmoBasis.recent_throughput_units).toLocaleString()}`
                : ""}
            </Typography>
          ) : null}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Process yield"
            value={`${((q.process_yield ?? 0) * 100).toFixed(1)}%`}
            subtitle={`RTY target ${(rtyTarget * 100).toFixed(0)}%`}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Config accuracy"
            value={`${((q.configuration_accuracy ?? 0) * 100).toFixed(1)}%`}
            subtitle={`Target ${(confTarget * 100).toFixed(0)}%`}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Cpk (reported)"
            value={Number(q.cpk ?? 0).toFixed(2)}
            subtitle={`Min ${Number(cpkTarget).toFixed(2)} (Settings)`}
            color="warning"
          />
        </Grid>
      </Grid>

      {capaSummary ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Chip size="small" label={`CAPA open: ${capaSummary.open ?? 0}`} color="warning" variant="outlined" />
          <Chip size="small" label={`In progress: ${capaSummary.in_progress ?? 0}`} color="primary" variant="outlined" />
          <Chip size="small" label={`Closed: ${capaSummary.closed ?? 0}`} variant="outlined" />
          <Chip size="small" label={`Total: ${capaSummary.total ?? 0}`} />
        </Stack>
      ) : null}

      <ActionRow
        actions={[
          { label: "Log Defect", onClick: () => setLogDefectOpen(true) },
          { label: "Open CAPA Case", variant: "contained", color: "secondary", onClick: () => setCapaOpen(true) },
          { label: "View Pareto Chart", variant: "outlined", color: "secondary", onClick: scrollToPareto },
          { label: "Rerun SPC", variant: "outlined", onClick: () => { reloadOperational(); setSpcSnack(true); } },
        ]}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box ref={paretoRef}>
            <CardBox title="Defect Pareto (wrong assembly, damage, and other types)">
              {paretoLabels.length ? (
                <MiniBarChart labels={paretoLabels} values={paretoValues} color="#ea580c" yLabel="Defect units (rolled up by type)" threshold={paretoThreshold} />
              ) : (
                <Typography variant="body2" color="text.secondary">No pareto data.</Typography>
              )}
            </CardBox>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Root causes of problems">
            {rootLabels.length ? (
              <MiniBarChart labels={rootLabels} values={rootValues} color="#7c3aed" yLabel="Defect units by root cause" threshold={null} />
            ) : (
              <Typography variant="body2" color="text.secondary">No root-cause attribution.</Typography>
            )}
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Defect trend (monthly units)">
            {trendLabels.length ? (
              <MiniLineChart
                labels={trendLabels}
                values={trendValues.length ? trendValues : [0]}
                color="#dc2626"
                yLabel="Defect units"
                yValueUnit=" units"
                chipLabel="Monthly defect units"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">No monthly defect history yet.</Typography>
            )}
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Six Sigma metrics vs Settings targets">
            <SimpleTable
              columns={["Metric", "Current", "Target (Settings)"]}
              rows={[
                ["DPMO", Math.round(q.dpmo ?? 0).toLocaleString(), Math.round(dpmoTarget).toLocaleString()],
                ["Yield / RTY", `${((q.process_yield ?? 0) * 100).toFixed(1)}%`, `${(rtyTarget * 100).toFixed(0)}%`],
                ["Configuration accuracy", `${((q.configuration_accuracy ?? 0) * 100).toFixed(1)}%`, `${(confTarget * 100).toFixed(0)}%`],
                ["Cpk", Number(q.cpk ?? 0).toFixed(2), Number(cpkTarget).toFixed(2)],
              ]}
            />
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Cost of poor quality (90 days)">
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              ${Math.round(q.copq_total_90d ?? copqBreakdown?.combined_90d ?? 0).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Track scrap, rework, returns, warranty, and expedite from quality-cost records plus return-event charges. Same window as the operational workbench.
            </Typography>
            <SimpleTable columns={["COPQ component", "Amount (90d)"]} rows={copqRows} loading={operationalLoading} />
          </CardBox>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }} ref={capaRef}>
        <CardBox title="CAPA tracker (corrective actions)">
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
            {["all", "open", "in_progress", "closed"].map((f) => (
              <Chip
                key={f}
                size="small"
                label={f === "all" ? "All" : f.replace("_", " ")}
                onClick={() => setCapaFilter(f)}
                color={capaFilter === f ? "secondary" : "default"}
                variant={capaFilter === f ? "filled" : "outlined"}
              />
            ))}
          </Stack>
          <SimpleTable
            columns={["CAPA #", "Title", "Status", "Opened", "Due", "Effective"]}
            rows={filteredCapa.map((c) => [
              c.capa_number,
              c.title,
              c.status,
              c.opened_date ?? "—",
              c.due_date ?? "—",
              c.effectiveness_verified ? "Yes" : "No",
            ])}
            loading={operationalLoading}
          />
        </CardBox>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
          Defect event log (API) — misbuilds & damage
        </Typography>
        <SimpleTable
          columns={["Body part", "Part", "Defect type", "Count", "Notes"]}
          rows={
            !sortedDefects.length
              ? []
              : Array.isArray(sortedDefects[0])
                ? sortedDefects
                : sortedDefects.map((d) => {
                    const partName = d.part_detail?.part_name ?? "—";
                    return [
                      formatPartTypeLabel(d.part_detail?.part_type ?? (partName !== "—" ? inferPartTypeFromName(partName) : null)),
                      partName,
                      d.defect_type_detail?.defect_name ??
                        (Number.isFinite(Number(d.defect_type)) ? `Defect #${d.defect_type}` : String(d.defect_type ?? "Defect")),
                      d.quantity || 1,
                      d.notes || "—",
                    ];
                  })
          }
          loading={defectsLoading}
        />
      </Box>
    </Page>
  );
}

function formatForecastParameterLabel(parameterName) {
  if (!parameterName) return "—";
  return String(parameterName)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const SETTINGS_TUNABLE_KEYS = [
  { key: "on_time_ship_target", label: "On-time ship target (48h window)", hint: "Compared on Orders & Targets" },
  { key: "ship_within_hours", label: "Ship goal (hours)", hint: "Orders KPI label" },
  { key: "dpmo_target", label: "DPMO target", hint: "Quality / Six Sigma" },
  { key: "target_rty", label: "Rolled throughput yield target", hint: "Quality" },
  { key: "min_cpk", label: "Minimum Cpk", hint: "Quality" },
  { key: "configuration_accuracy_target", label: "Configuration accuracy target", hint: "Quality & dashboard" },
  { key: "service_level_target", label: "Service level", hint: "Planning / inventory" },
  { key: "default_safety_stock_days", label: "Default safety stock (days)", hint: "Planning" },
];

function Settings() {
  const {
    operational,
    operationalLoading,
    operationalSource,
    mergedParameterMap,
    parameterOverrides,
    saveParameterOverrides,
    clearParameterOverrides,
  } = useOperationalWorkbench();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");
  const [draft, setDraft] = useState({});
  const [saveNote, setSaveNote] = useState("");

  useEffect(() => {
    getForecastParameters()
      .then((list) => {
        setRows(Array.isArray(list) ? list : []);
        setSource("live");
      })
      .catch(() => {
        setRows([]);
        setSource("mock");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const next = {};
    for (const { key } of SETTINGS_TUNABLE_KEYS) {
      const v = mergedParameterMap[key];
      next[key] = v !== undefined && v !== null ? String(v) : "";
    }
    setDraft(next);
  }, [mergedParameterMap]);

  const baseMap = operational?.forecast_parameter_map ?? {};

  const onSaveBrowserTuning = () => {
    const patch = {};
    for (const { key } of SETTINGS_TUNABLE_KEYS) {
      const raw = draft[key];
      if (raw === "" || raw === undefined) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) patch[key] = n;
    }
    saveParameterOverrides(patch);
    setSaveNote("Saved to this browser. Orders and Quality use these effective values until you clear overrides.");
  };

  return (
    <Page
      title="Settings"
      subtitle={
        operational?.purpose?.settings ??
        "Control forecasting parameters, safety stock, ship and quality targets, and other thresholds — tied to Orders & Targets and Quality / Six Sigma."
      }
    >
      <CardBox title="Purpose">
        <Typography variant="body2" color="text.secondary">
          Adjust forecasting parameters, safety stock levels, seasonality windows, ship and quality targets, and other rules. Values below marked as shared
          drive the KPI targets on <strong>Orders & Targets</strong> and <strong>Quality / Six Sigma</strong>. Browser overrides apply immediately on those
          pages without changing the database (useful for what-if reviews).
        </Typography>
      </CardBox>

      {operationalSource === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Operational workbench offline — forecast table may still load; tuning defaults use embedded fallbacks until the API is available.
        </Alert>
      ) : null}
      {source === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Forecast parameters API unavailable. Run the Django API and import seed data (<code>forecast_parameters.csv</code>).
        </Alert>
      ) : null}

      {saveNote ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveNote("")}>
          {saveNote}
        </Alert>
      ) : null}

      <CardBox title="Shared targets (browser overrides)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Edit and save to store overrides in local storage. <strong>Effective value</strong> = server parameter merged with your override.{" "}
          {Object.keys(parameterOverrides).length ? (
            <Button size="small" onClick={() => { clearParameterOverrides(); setSaveNote("Cleared browser overrides."); }}>
              Clear overrides
            </Button>
          ) : null}
        </Typography>
        <Grid container spacing={2}>
          {SETTINGS_TUNABLE_KEYS.map(({ key, label, hint }) => {
            const hasOverride = Object.prototype.hasOwnProperty.call(parameterOverrides, key);
            const serverVal = baseMap[key];
            const effective = mergedParameterMap[key];
            return (
              <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={label}
                  helperText={`${hint} · Server: ${serverVal ?? "—"} · Effective: ${effective ?? "—"}${hasOverride ? " (override)" : ""}`}
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </Grid>
            );
          })}
        </Grid>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="contained" color="secondary" onClick={onSaveBrowserTuning}>
            Save browser tuning
          </Button>
        </Stack>
      </CardBox>

      <ActionRow
        actions={[
          { label: "Edit Parameter" },
          { label: "Delete Variable", variant: "outlined", color: "error" },
          { label: "Save Scenario" },
          { label: "Clone Scenario", variant: "contained", color: "secondary" },
        ]}
      />

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, mt: 1 }}>
        All forecast parameters (database)
      </Typography>
      <SimpleTable
        columns={["Parameter", "Stored value", "Effective", "Type", "Active", "Used on"]}
        rows={rows.map((p) => {
          const name = p.parameter_name;
          const tunable = SETTINGS_TUNABLE_KEYS.some((t) => t.key === name);
          const seasonal = /season|promo|christmas|easter|mega/i.test(name);
          const usedOn = tunable ? "Orders / Quality" : seasonal ? "Forecasting" : "Planning / other";
          const eff = mergedParameterMap[name];
          const stored = p.parameter_value ?? "—";
          const effDisp = eff !== undefined && eff !== null ? String(eff) : "—";
          return [
            formatForecastParameterLabel(name),
            stored,
            effDisp,
            p.parameter_type ?? "—",
            p.is_active ? "Yes" : "No",
            usedOn,
          ];
        })}
        loading={loading || operationalLoading}
      />
    </Page>
  );
}

function NotFound() {
  return (
    <Page title="Page Not Found" subtitle="The route you opened is not part of this app. Use the sidebar or go home.">
      <Stack alignItems="center" sx={{ py: { xs: 4, sm: 6 } }}>
        <Card elevation={0} sx={{ width: 1, maxWidth: 440, textAlign: "center", ...CARD_POLISH_SX, borderRadius: 2 }}>
          <CardContent sx={{ py: 3 }}>
            <Typography variant="overline" sx={{ letterSpacing: "0.2em", color: "text.secondary" }}>
              Error
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, my: 1, color: "primary.main" }}>
              404
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.55 }}>
              This URL does not match any screen in OptiDoll Sigma.
            </Typography>
            <Button component={Link} to="/" variant="contained" size="large">
              Back to Executive Overview
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Page>
  );
}

function Page({ title, subtitle, children }) {
  return (
    <Box sx={{ pb: { xs: 2.5, sm: 3 }, maxWidth: PAGE_MAX_WIDTH_PX, mx: "auto", width: 1 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: "-0.02em", mb: 0.5, color: "text.primary" }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 2, sm: 3 }, maxWidth: "72ch", lineHeight: 1.55 }}>
          {subtitle}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}

function kpiStatusChipLabel(color) {
  const c = String(color || "primary");
  if (c === "success") return "Good";
  if (c === "warning") return "Watch";
  if (c === "error") return "Risk";
  if (c === "secondary") return "Focus";
  return "Info";
}

function KpiCard({ title, value, subtitle, color = "primary" }) {
  return (
    <Card elevation={0} sx={{ height: "100%", borderRadius: 2, ...CARD_POLISH_SX }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.25 }, "&:last-child": { pb: { xs: 2, sm: 2.25 } } }}>
        <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.5rem", sm: "1.75rem" } }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.45 }}>
          {subtitle}
        </Typography>
        <Chip color={color} label={kpiStatusChipLabel(color)} size="small" sx={{ mt: 2, fontWeight: 700 }} />
      </CardContent>
    </Card>
  );
}

function CardBox({ title, children }) {
  return (
    <Card elevation={0} sx={{ mb: 2.5, borderRadius: 2, ...CARD_POLISH_SX }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800, letterSpacing: "0.01em" }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportSvgElement(svgEl, filename) {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const markup = serializer.serializeToString(svgEl);
  downloadBlob(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`);
}

function exportSvgAsPng(svgEl, filename) {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const markup = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) downloadBlob(pngBlob, `${filename}.png`);
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function MiniLineChart({ labels, values, color = primaryMain, yLabel = "", yValueUnit = "", targetValue = null, chipLabel = "Projected Orders" }) {
  const fmt = (n) => `${Number(n).toLocaleString()}${yValueUnit}`;
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);
  const chartHeight = 220;
  const chartWidth = 720;
  const padX = 28;
  const padY = 16;
  const stepX = (chartWidth - padX * 2) / Math.max(1, values.length - 1);

  const svgRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const lineTop = padY;
  const lineBottom = chartHeight - padY;

  const points = values.map((value, idx) => {
    const x = padX + idx * stepX;
    const y = lineBottom - ((value - minValue) / range) * (chartHeight - padY * 2);
    return { x, y, value, label: labels[idx] };
  });

  const smoothPath = points.reduce((path, point, idx, arr) => {
    if (idx === 0) return `M ${point.x} ${point.y}`;
    const prev = arr[idx - 1];
    const cx = (prev.x + point.x) / 2;
    return `${path} Q ${cx} ${prev.y}, ${point.x} ${point.y}`;
  }, "");

  const targetY = targetValue === null
    ? null
    : lineBottom - ((targetValue - minValue) / range) * (chartHeight - padY * 2);

  return (
    <Box sx={{ borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0", p: 2 }}>
      <Stack direction="row" sx={{ mb: 1, justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Chip size="small" label={chipLabel} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: primaryMain }} />
          {targetValue !== null ? <Chip size="small" label={`Target ${fmt(targetValue)}`} sx={{ bgcolor: "rgba(16, 185, 129, 0.12)", color: "#047857" }} /> : null}
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Export SVG" {...TOOLTIP_DELAY_PROPS}>
            <IconButton size="small" aria-label="Export line chart as SVG" onClick={() => exportSvgElement(svgRef.current, "demand-forecast")}>
              <FileDownloadOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export PNG" {...TOOLTIP_DELAY_PROPS}>
            <IconButton size="small" aria-label="Export line chart as PNG" onClick={() => exportSvgAsPng(svgRef.current, "demand-forecast")}>
              <ImageOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <svg ref={svgRef} width={chartWidth} height={chartHeight} role="img" aria-label={yLabel ? `${yLabel} over time` : "Line chart"}>
          <line x1={padX} y1={lineBottom} x2={chartWidth - padX} y2={lineBottom} stroke="#94a3b8" />
          <line x1={padX} y1={lineTop} x2={padX} y2={lineBottom} stroke="#94a3b8" />
          {targetY !== null ? (
            <>
              <line x1={padX} y1={targetY} x2={chartWidth - padX} y2={targetY} stroke="#10b981" strokeDasharray="6 6" />
              <text x={chartWidth - padX} y={targetY - 6} fontSize="12" fill="#047857" textAnchor="end">{`Target ${fmt(targetValue)}`}</text>
            </>
          ) : null}
          <path d={smoothPath} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point) => (
            <circle
              key={point.label}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={color}
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <title>{`${point.label}: ${fmt(point.value)}`}</title>
            </circle>
          ))}
          {hoveredPoint ? (
            <g>
              <rect
                x={Math.max(padX + 4, hoveredPoint.x - 52)}
                y={Math.max(lineTop + 4, hoveredPoint.y - 30)}
                width="104"
                height="22"
                rx="6"
                fill="#0f172a"
                opacity="0.92"
              />
              <text
                x={Math.max(padX + 56, hoveredPoint.x)}
                y={Math.max(lineTop + 18, hoveredPoint.y - 15)}
                fontSize="12"
                fill="#ffffff"
                textAnchor="middle"
              >
                {`${hoveredPoint.label}: ${fmt(hoveredPoint.value)}`}
              </text>
            </g>
          ) : null}
          <text x={padX} y={padY + 2} fontSize="12" fill="#475569">{fmt(maxValue)}</text>
          <text x={padX} y={lineBottom + 14} fontSize="12" fill="#475569">{fmt(minValue)}</text>
          <text x={chartWidth - padX} y={padY + 2} fontSize="12" fill="#64748b" textAnchor="end">{yLabel}</text>
        </svg>
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ mt: 1.2, flexWrap: "wrap" }}>
        {labels.map((label, idx) => (
          <Typography key={label} variant="caption" color="text.secondary">{`${label}: ${fmt(values[idx])}`}</Typography>
        ))}
      </Stack>
    </Box>
  );
}

function MiniBarChart({ labels, values, color = "#ea580c", yLabel = "", threshold = null }) {
  const maxValue = Math.max(...values, 1);
  const svgRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const chartWidth = 720;
  const chartHeight = 250;
  const padX = 22;
  const padY = 18;
  const plotHeight = chartHeight - padY * 2;
  const barGap = 10;
  const barAreaWidth = chartWidth - padX * 2;
  const barWidth = (barAreaWidth - barGap * (labels.length - 1)) / labels.length;

  return (
    <Box sx={{ borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0", p: 2 }}>
      <Stack direction="row" sx={{ mb: 1, justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Chip size="small" label="Defect Count" sx={{ bgcolor: "rgba(234, 88, 12, 0.12)", color: "#c2410c" }} />
          {threshold !== null ? <Chip size="small" label={`Threshold ${threshold}`} sx={{ bgcolor: "rgba(220, 38, 38, 0.12)", color: "#b91c1c" }} /> : null}
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Export SVG" {...TOOLTIP_DELAY_PROPS}>
            <IconButton size="small" aria-label="Export pareto chart as SVG" onClick={() => exportSvgElement(svgRef.current, "defect-pareto")}>
              <FileDownloadOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export PNG" {...TOOLTIP_DELAY_PROPS}>
            <IconButton size="small" aria-label="Export pareto chart as PNG" onClick={() => exportSvgAsPng(svgRef.current, "defect-pareto")}>
              <ImageOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{yLabel}</Typography>
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <svg ref={svgRef} width={chartWidth} height={chartHeight} role="img" aria-label="Defect pareto chart">
          <line x1={padX} y1={chartHeight - padY} x2={chartWidth - padX} y2={chartHeight - padY} stroke="#94a3b8" />
          <line x1={padX} y1={padY} x2={padX} y2={chartHeight - padY} stroke="#94a3b8" />
          {threshold !== null ? (
            <line
              x1={padX}
              y1={chartHeight - padY - (threshold / maxValue) * plotHeight}
              x2={chartWidth - padX}
              y2={chartHeight - padY - (threshold / maxValue) * plotHeight}
              stroke="#dc2626"
              strokeDasharray="5 4"
            />
          ) : null}
          {labels.map((label, idx) => {
            const value = values[idx];
            const height = (value / maxValue) * plotHeight;
            const x = padX + idx * (barWidth + barGap);
            const y = chartHeight - padY - height;
            const isWarning = threshold !== null && value >= threshold;
            return (
              <g key={label}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="4"
                  fill={isWarning ? "#dc2626" : color}
                  onMouseEnter={() => setHoveredBar({ label, value, x, y })}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <text x={x + barWidth / 2} y={chartHeight - 2} fontSize="11" fill="#334155" textAnchor="middle">
                  {label.slice(0, 7)}
                </text>
              </g>
            );
          })}
          {hoveredBar ? (
            <g>
              <rect
                x={Math.max(padX + 2, hoveredBar.x - 14)}
                y={Math.max(padY + 4, hoveredBar.y - 28)}
                width="128"
                height="22"
                rx="6"
                fill="#0f172a"
                opacity="0.92"
              />
              <text x={Math.max(padX + 66, hoveredBar.x + 50)} y={Math.max(padY + 18, hoveredBar.y - 13)} fontSize="12" fill="#ffffff" textAnchor="middle">
                {`${hoveredBar.label}: ${hoveredBar.value}`}
              </text>
            </g>
          ) : null}
        </svg>
      </Box>
    </Box>
  );
}

function normalizeActions(items) {
  return items.map((item) =>
    typeof item === "string"
      ? { label: item, variant: "contained", color: "primary", size: "small" }
      : { variant: "contained", color: "primary", size: "small", ...item }
  );
}

function ActionRow({ actions }) {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState("");
  const resolved = normalizeActions(actions);

  const onActionClick = (label) => {
    setSelectedAction(label);
    setSnackbarOpen(true);
  };

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: "wrap", gap: 1, rowGap: 1.25 }}>
        {resolved.map((a) => (
          <Tooltip
            key={a.label}
            title={a.loading ? "Working…" : `${a.label} action`}
            arrow
            {...TOOLTIP_DELAY_PROPS}
          >
            <Button
              variant={a.variant}
              color={a.color}
              size={a.size}
              disabled={Boolean(a.disabled || a.loading)}
              onClick={() => {
                if (typeof a.onClick === "function") {
                  a.onClick();
                  return;
                }
                onActionClick(a.label);
              }}
              aria-label={a.label}
              startIcon={a.loading ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}
            >
              {a.loading && a.loadingLabel ? a.loadingLabel : a.label}
            </Button>
          </Tooltip>
        ))}
      </Stack>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2200}
        onClose={() => setSnackbarOpen(false)}
        message={`${selectedAction} is queued for implementation`}
      />
    </>
  );
}

/** Rich cell: `{ display, sortValue?, searchText? }` for custom render + sort/search. */
function tableCellSearchText(cell) {
  if (cell != null && typeof cell === "object" && !Array.isArray(cell) && "searchText" in cell) {
    return String(cell.searchText ?? "");
  }
  return String(cell ?? "");
}

function tableCellSortKey(cell) {
  if (cell != null && typeof cell === "object" && !Array.isArray(cell) && "sortValue" in cell) {
    return String(cell.sortValue ?? "");
  }
  return String(cell ?? "");
}

function formatPrimitiveTableCell(value, columnName) {
  if (value === null || value === undefined) return "-";

  const column = String(columnName || "").toLowerCase();
  const num = Number(value);
  const isNumber = !Number.isNaN(num) && value !== "";

  if ((column.includes("rate") || column.includes("accuracy") || column.includes("achievement")) && isNumber) {
    const pct = num <= 1 ? num * 100 : num;
    return `${pct.toFixed(1)}%`;
  }

  if (column.includes("risk")) {
    const riskLabel = String(value || "review").toUpperCase();
    return <Chip size="small" color={riskToColor(value)} label={riskLabel} />;
  }

  if (column.includes("delta") && isNumber) {
    const display = `${num > 0 ? "+" : ""}${num}`;
    const tone = num < 0 ? "error.main" : num === 0 ? "warning.main" : "success.main";
    return <Typography sx={{ fontWeight: 700, color: tone }}>{display}</Typography>;
  }

  if ((column.includes("cost") || column.includes("price") || column.includes("amount") || column.includes("value")) && isNumber) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
  }

  if (column.includes("date") || column.includes("period")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
    }
  }

  return String(value);
}

function renderTableCell(cell, columnName) {
  if (cell != null && typeof cell === "object" && !Array.isArray(cell) && "display" in cell) {
    return cell.display;
  }
  return formatPrimitiveTableCell(cell, columnName);
}

function SimpleTable({ columns, rows, loading = false }) {
  const [searchText, setSearchText] = useState("");
  const [sortConfig, setSortConfig] = useState({ index: 0, direction: "asc" });
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        row.some((cell) => tableCellSearchText(cell).toLowerCase().includes(searchText.trim().toLowerCase()))
      ),
    [rows, searchText]
  );

  const sortedRows = useMemo(() => {
    const { index, direction } = sortConfig;
    return [...filteredRows].sort((a, b) => {
      const left = tableCellSortKey(a[index]);
      const right = tableCellSortKey(b[index]);
      const comparison = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return direction === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [currentPage, sortedRows]);

  const onSort = (index) => {
    setSortConfig((current) => ({
      index,
      direction: current.index === index && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <Card elevation={0} sx={{ mb: 2.5, borderRadius: 2, ...CARD_POLISH_SX }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
        <TextField
          size="small"
          placeholder="Search rows…"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          sx={{ mb: 2, maxWidth: 360, width: { xs: 1, sm: "auto" } }}
          aria-label="Search table rows"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        {loading ? (
          <Stack spacing={1.2}>
            <Skeleton variant="rounded" height={36} />
            <Skeleton variant="rounded" height={36} />
            <Skeleton variant="rounded" height={36} />
          </Stack>
        ) : sortedRows.length ? (
          <>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ maxHeight: 420, borderRadius: 2, borderColor: "rgba(15,23,42,0.1)", boxShadow: "none" }}
            >
              <Table stickyHeader size="small" aria-label="data table">
                <TableHead>
                  <TableRow>
                    {columns.map((c, index) => (
                      <TableCell key={c} sx={{ fontWeight: 700, bgcolor: (t) => t.palette.grey[50] }}>
                        <TableSortLabel
                          active={sortConfig.index === index}
                          direction={sortConfig.index === index ? sortConfig.direction : "asc"}
                          onClick={() => onSort(index)}
                          sx={{
                            "&.Mui-active": { color: primaryMain },
                            "& .MuiTableSortLabel-icon": { color: `${primaryMain} !important` },
                          }}
                        >
                          {c}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedRows.map((row, idx) => (
                    <TableRow key={`${idx}-${String(row[0] ?? "")}`} hover>
                      {row.map((cell, i) => (
                        <TableCell key={i}>{renderTableCell(cell, columns[i])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction="row" sx={{ mt: 1.5, justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Showing {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, sortedRows.length)} of {sortedRows.length}
              </Typography>
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_, nextPage) => setPage(nextPage)}
                size="small"
                shape="rounded"
                sx={{
                  "& .MuiPaginationItem-root": { color: primaryMain },
                  "& .Mui-selected": {
                    bgcolor: primaryMain,
                    color: "#fff",
                  },
                  "& .Mui-selected:hover": {
                    bgcolor: primaryDark,
                  },
                }}
              />
            </Stack>
          </>
        ) : (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center", fontStyle: "italic" }}>
            No records match the current filter.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function riskToColor(risk) {
  const value = String(risk || "").toLowerCase();
  if (value === "red") return "error";
  if (value === "yellow" || value === "amber") return "warning";
  if (value === "green") return "success";
  return "primary";
}

function getInventoryRiskLevel(availableQty, reorderPointQty) {
  const available = Number(availableQty || 0);
  const reorderPoint = Number(reorderPointQty || 0);
  const delta = available - reorderPoint;
  if (delta < 0) return "red";
  if (delta <= Math.max(10, reorderPoint * 0.15)) return "yellow";
  return "green";
}

export default App;
