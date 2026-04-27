import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getOrders,
  getDefects,
  getForecastParameters,
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
  on_time_48h_rate: 0.968,
  total_defects: 58,
  configuration_accuracy: 0.982,
  estimated_dpmo: 3900,
  inventory_records: 220,
  supplier_count: 24,
  recommendation_count: 42,
  risk_level: "yellow",
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

const DASHBOARD_ALERT_CHIPS = [
  { partType: "head", color: "error", label: "RED: Skin tone heads shortage risk" },
  { partType: "hair", color: "warning", label: "YELLOW: Hair supplier lead time increased" },
  { partType: "torso", color: "success", label: "GREEN: Completed torso inventory safe" },
  { partType: null, color: "warning", label: "YELLOW: Wrong assembly rate above target" },
];

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

          <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, minWidth: 0 }}>
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
    </BrowserRouter>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState(mockSummary);
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    getDashboardSummary()
      .then((data) => {
        setSummary(data);
        setBackendStatus("connected");
      })
      .catch(() => {
        setSummary(mockSummary);
        setBackendStatus("mock");
      });
  }, []);

  const onTime = `${(summary.on_time_48h_rate * 100).toFixed(1)}%`;
  const accuracy = `${(summary.configuration_accuracy * 100).toFixed(1)}%`;

  return (
    <Page title="Executive Overview" subtitle="Real-time visibility across service level, quality, and fulfillment risk.">
      {backendStatus === "checking" ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Syncing latest backend KPIs...
          </Typography>
        </Stack>
      ) : null}
      {backendStatus === "connected" ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Connected to Django backend.
        </Alert>
      ) : backendStatus === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Backend not reached. Showing mock dashboard data.
        </Alert>
      ) : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 3 }}>
          <KpiCard title="Inventory Risk" value={summary.risk_level?.toUpperCase()} subtitle="Current planning status" color={riskToColor(summary.risk_level)} />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <KpiCard title="48-Hour Ship Rate" value={onTime} subtitle="Target: 98%" color="warning" />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <KpiCard title="Configuration Accuracy" value={accuracy} subtitle="Correct custom builds" color="success" />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <KpiCard title="Estimated DPMO" value={Math.round(summary.estimated_dpmo)} subtitle="Six Sigma quality metric" color="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <CardBox title="Demand Forecast">
            <MiniLineChart
              labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
              values={[820, 880, 1030, 970, 1120, 1240, 1160, 1190, 1320, 1680, 2010, 2260]}
              color={primaryMain}
              yLabel="Orders"
              targetValue={1500}
            />
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CardBox title="Current Alerts">
            <Stack spacing={1}>
              {[...DASHBOARD_ALERT_CHIPS]
                .sort((a, b) => {
                  const c = partTypeSortIndex(a.partType) - partTypeSortIndex(b.partType);
                  return c !== 0 ? c : a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
                })
                .map((chip) => (
                  <Chip key={chip.label} color={chip.color} label={chip.label} />
                ))}
            </Stack>
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

function Forecasting() {
  return (
    <Page title="Forecasting Workbench" subtitle="Model demand, seasonality, and supply recommendations in one flow.">
      <ActionRow actions={["Train Model", "Compare Models", "Edit Seasonality", "Recalculate Forecast"]} />
      <CardBox title="Forecast Logic">
        <Typography>
          Forecasts monthly sales, explodes demand into doll parts, applies Christmas and Easter seasonal lifts,
          and creates monthly supply order recommendations.
        </Typography>
      </CardBox>
    </Page>
  );
}

function Orders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");

  useEffect(() => {
    getOrders()
      .then((data) => {
        setRows(data.results || data);
        setSource("live");
      })
      .catch(() => {
        setRows([
          ["Today", 42, 40, 39, "93%"],
          ["This Week", 294, 281, 276, "94%"],
        ]);
        setSource("mock");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Page title="Orders & Daily/Weekly Targets" subtitle="Track output vs goals and ship-rate adherence.">
      {source === "mock" ? <Alert severity="warning" sx={{ mb: 2 }}>Orders API unavailable. Showing fallback summary.</Alert> : null}
      <ActionRow
        actions={[
          { label: "Generate Order Plan", variant: "contained", color: "secondary" },
          { label: "Export Report", variant: "outlined", color: "secondary" },
          { label: "Approve Order", variant: "contained", color: "success" },
          { label: "Review Risk", variant: "contained", color: "warning" },
        ]}
      />
      <SimpleTable
        columns={["Period", "Target Orders", "Assembled", "Shipped", "Achievement"]}
        rows={Array.isArray(rows[0]) ? rows : rows.slice(0, 10).map((o) => [o.order_number, "-", "-", o.status, "-"])}
        loading={loading}
      />
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

function Quality() {
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");

  const sortedDefects = useMemo(() => {
    if (!defects.length || Array.isArray(defects[0])) return defects;
    return [...defects].sort(compareDefectRecords);
  }, [defects]);

  useEffect(() => {
    getDefects()
      .then((data) => {
        setDefects(data.results || data);
        setSource("live");
      })
      .catch(() => {
        setDefects([
          ["Wrong Assembly", 18, "Wrong part in bin"],
          ["Damaged Return", 9, "Shipping damage"],
          ["Missing Component", 7, "Picking error"],
        ]);
        setSource("mock");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Page title="Quality / Six Sigma" subtitle="Prioritize defect drivers and keep process capability on target.">
      {source === "mock" ? <Alert severity="warning" sx={{ mb: 2 }}>Defects API unavailable. Showing fallback defects.</Alert> : null}
      <ActionRow actions={["Log Defect", "Open CAPA Case", "View Pareto Chart", "Rerun SPC"]} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Defect Pareto">
            <MiniBarChart
              labels={["Wrong Assembly", "Damaged Return", "Missing Part", "Cosmetic", "Late Shipment"]}
              values={[18, 9, 7, 6, 4]}
              color="#ea580c"
              yLabel="Defects"
              threshold={10}
            />
          </CardBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CardBox title="Six Sigma Controls">
            <SimpleTable
              columns={["Metric", "Current", "Target"]}
              rows={[
                ["DPMO", "3,900", "3,400"],
                ["RTY", "94.8%", "95%"],
                ["Configuration Accuracy", "98.2%", "99%"],
                ["Cpk", "1.21", "1.33"],
              ]}
            />
          </CardBox>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <SimpleTable
          columns={["Body part", "Part", "Defect type", "Count", "Notes"]}
          rows={
            Array.isArray(sortedDefects[0])
              ? sortedDefects
              : sortedDefects.map((d) => {
                  const partName = d.part_detail?.part_name ?? "—";
                  return [
                    formatPartTypeLabel(d.part_detail?.part_type ?? (partName !== "—" ? inferPartTypeFromName(partName) : null)),
                    partName,
                    d.defect_type_detail?.defect_name ?? (Number.isFinite(Number(d.defect_type)) ? `Defect #${d.defect_type}` : String(d.defect_type ?? "Defect")),
                    d.quantity || 1,
                    d.notes || "—",
                  ];
                })
          }
          loading={loading}
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

function Settings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("live");

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

  return (
    <Page title="Settings & Parameters" subtitle="Control planning thresholds and operational targets.">
      {source === "mock" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Forecast parameters API unavailable. No rows to show — run the Django API and import seed data (
          <code>forecast_parameters.csv</code>).
        </Alert>
      ) : null}
      <ActionRow
        actions={[
          { label: "Edit Parameter" },
          { label: "Delete Variable", variant: "outlined", color: "error" },
          { label: "Save Scenario" },
          { label: "Clone Scenario", variant: "contained", color: "secondary" },
        ]}
      />
      <SimpleTable
        columns={["Parameter", "Value", "Type", "Effective from", "Effective to", "Active", "Editable"]}
        rows={rows.map((p) => [
          formatForecastParameterLabel(p.parameter_name),
          p.parameter_value ?? "—",
          p.parameter_type ?? "—",
          p.effective_start ?? "—",
          p.effective_end ?? "—",
          p.is_active ? "Yes" : "No",
          "Yes",
        ])}
        loading={loading}
      />
    </Page>
  );
}

function NotFound() {
  return (
    <Page title="Page Not Found" subtitle="Use the left navigation to continue.">
      <Alert severity="info">The requested page does not exist.</Alert>
    </Page>
  );
}

function Page({ title, subtitle, children }) {
  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>
          {subtitle}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}

function KpiCard({ title, value, subtitle, color = "primary" }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography color="text.secondary" variant="body2">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
        <Chip color={color} label={color.toUpperCase()} size="small" sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

function CardBox({ title, children }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
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

function MiniLineChart({ labels, values, color = primaryMain, yLabel = "", targetValue = null }) {
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
          <Chip size="small" label="Projected Orders" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: primaryMain }} />
          {targetValue !== null ? <Chip size="small" label={`Target ${targetValue}`} sx={{ bgcolor: "rgba(16, 185, 129, 0.12)", color: "#047857" }} /> : null}
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
        <svg ref={svgRef} width={chartWidth} height={chartHeight} role="img" aria-label="Forecast line chart">
          <line x1={padX} y1={lineBottom} x2={chartWidth - padX} y2={lineBottom} stroke="#94a3b8" />
          <line x1={padX} y1={lineTop} x2={padX} y2={lineBottom} stroke="#94a3b8" />
          {targetY !== null ? (
            <>
              <line x1={padX} y1={targetY} x2={chartWidth - padX} y2={targetY} stroke="#10b981" strokeDasharray="6 6" />
              <text x={chartWidth - padX} y={targetY - 6} fontSize="12" fill="#047857" textAnchor="end">{`Target ${targetValue}`}</text>
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
              <title>{`${point.label}: ${point.value}`}</title>
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
                {`${hoveredPoint.label}: ${hoveredPoint.value}`}
              </text>
            </g>
          ) : null}
          <text x={padX} y={padY + 2} fontSize="12" fill="#475569">{maxValue}</text>
          <text x={padX} y={lineBottom + 14} fontSize="12" fill="#475569">{minValue}</text>
          <text x={chartWidth - padX} y={padY + 2} fontSize="12" fill="#64748b" textAnchor="end">{yLabel}</text>
        </svg>
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ mt: 1.2, flexWrap: "wrap" }}>
        {labels.map((label, idx) => (
          <Typography key={label} variant="caption" color="text.secondary">{`${label}: ${values[idx]}`}</Typography>
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
      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: "wrap" }}>
        {resolved.map((a) => (
          <Tooltip key={a.label} title={`${a.label} action`} arrow {...TOOLTIP_DELAY_PROPS}>
            <Button
              variant={a.variant}
              color={a.color}
              size={a.size}
              onClick={() => {
                if (typeof a.onClick === "function") {
                  a.onClick();
                  return;
                }
                onActionClick(a.label);
              }}
              aria-label={a.label}
            >
              {a.label}
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
    <Card>
      <CardContent>
        <TextField
          size="small"
          placeholder="Search rows..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          sx={{ mb: 1.5, maxWidth: 320 }}
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
              sx={{ maxHeight: 420, borderRadius: 2, borderColor: "#e6ebf2", boxShadow: "none" }}
            >
              <Table stickyHeader size="small" aria-label="data table">
                <TableHead>
                  <TableRow>
                    {columns.map((c, index) => (
                      <TableCell key={c} sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>
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
          <Typography color="text.secondary">No records available.</Typography>
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
