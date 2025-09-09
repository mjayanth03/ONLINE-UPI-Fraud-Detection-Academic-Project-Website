import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * UPI Fraud Detector — Mobile (Expo, single-file)
 * -------------------------------------------------
 * Project: ONLINE UPI FRAUD DETECTION USING MACHINE LEARNING
 * Submitted in partial fulfilment of the requirements for the degree of
 * B.Tech in CSE (Data Science)
 * By: B. Hema Dinesh (22U41A4405), S. Lakshman Kumar (22U41A4442),
 *     M. Jayanth Kumar (22U41A4431), P. Sai Vignesh (22U41A4432)
 * Under the supervision of M. Kalyani, Assistant Professor
 * Dadi Institute of Engineering & Technology, Anakapalle, Vizag (A.P.)
 * March 2026
 * -------------------------------------------------
 * Framework Overview:
 * - Detects UPI transaction fraud using ML (Logistic Regression, Random Forest, Gradient Boosting, Ensembles)
 * - Handles imbalance via SMOTE
 * - Extracts features: amount, timestamp, location, device ID, behavior patterns
 * - Provides risk scores in real time, reducing false positives & ensuring trust in digital payments
 * Keywords: UPI, Fraud Detection, Machine Learning, Ensemble Learning, SMOTE, Cybersecurity, Digital Payments, Behavioral Analytics
 * -------------------------------------------------
 * How to run
 * 1) npm i -g expo-cli
 * 2) npx expo init fraud-mobile --template blank
 * 3) Replace App.js with this file
 * 4) Set API_URL below (or leave empty to use Mock mode)
 * 5) npx expo start
 */

// --- CONFIG ---------------------------------------------------------------
const API_URL = ""; // e.g., "http://10.0.2.2:8000" (Android emulator) or "http://localhost:8000"

// --- UTILITIES ------------------------------------------------------------
const tw = (cls = "") => ({
  container: { flex: 1, backgroundColor: "#0B1220" },
  pad: { padding: 20 },
  card: { backgroundColor: "#121A2B", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 },
  row: { flexDirection: "row", alignItems: "center" },
  between: { justifyContent: "space-between" },
  input: { backgroundColor: "#0F1626", color: "#E5EDFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#1E2A44", marginTop: 10 },
  label: { color: "#9FB3C8", fontSize: 13, marginTop: 14 },
  h1: { color: "#E5EDFF", fontSize: 22, fontWeight: "800" },
  h2: { color: "#C9D7F2", fontSize: 16, fontWeight: "700" },
  p: { color: "#B3C1D9", fontSize: 13, lineHeight: 18 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#0F2436" },
  chipText: { color: "#9CD67C", fontWeight: "600" },
  btn: { backgroundColor: "#2E5BFF", paddingVertical: 14, borderRadius: 16, alignItems: "center", marginTop: 18 },
  btnGhost: { backgroundColor: "#182336", paddingVertical: 12, borderRadius: 12, alignItems: "center", marginTop: 10 },
  btnText: { color: "white", fontWeight: "800", fontSize: 16 },
  small: { color: "#7E8CA6", fontSize: 12 },
});

function fmt(n) {
  if (n === undefined || n === null || isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function riskColor(score) {
  if (score >= 0.8) return "#F05252";
  if (score >= 0.4) return "#F59E0B";
  return "#10B981";
}

function Gauge({ score = 0 }) {
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ height: 14, backgroundColor: "#16243B", borderRadius: 999, overflow: "hidden" }}>
        <View style={{ width: `${Math.min(100, Math.max(0, score * 100))}%`, height: "100%", backgroundColor: riskColor(score) }} />
      </View>
      <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#9FB3C8", fontSize: 12 }}>0</Text>
        <Text style={{ color: "#9FB3C8", fontSize: 12 }}>0.5</Text>
        <Text style={{ color: "#9FB3C8", fontSize: 12 }}>1.0</Text>
      </View>
    </View>
  );
}

// --- MOCK PREDICTOR -------------------------------------------------------
async function mockPredict(payload) {
  const amount = Number(payload.amount || 0);
  const night = (() => { try { const h = new Date(payload.timestamp).getHours(); return (h >= 23 || h <= 5); } catch { return false; } })();
  const burst = Number(payload.txnCountLastHour || 0) >= 5;
  let score = 0.05;
  score += Math.min(0.7, Math.max(0, (amount - 3000) / 10000));
  if (night) score += 0.15;
  if (burst) score += 0.2;
  score = Math.max(0, Math.min(1, score));
  return {
    label: score >= 0.5 ? "FRAUD" : "LEGIT",
    score,
    top_features: [
      { name: "amount", value: amount, weight: +(Math.min(0.4, Math.max(0, (amount - 2000) / 8000))).toFixed(2) },
      { name: "txnCountLastHour", value: payload.txnCountLastHour, weight: burst ? 0.2 : 0.03 },
      { name: "timestamp", value: payload.timestamp, weight: night ? 0.15 : 0.02 },
    ],
  };
}

async function predict(payload) {
  if (!API_URL) return mockPredict(payload);
  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const initialForm = {
  amount: "",
  timestamp: new Date().toISOString(),
  payerId: "u_12345",
  payeeId: "m_67890",
  deviceId: "dev-abc123",
  geoLat: "",
  geoLon: "",
  txnCountLastHour: "",
  avgTicketLast7d: "",
};

export default function App() {
  const s = tw();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const labelColor = useMemo(() => (result ? riskColor(result?.score ?? 0) : "#9FB3C8"), [result]);

  const onSubmit = async () => {
    if (!form.amount) return Alert.alert("Missing amount", "Please enter a transaction amount.");
    try {
      setLoading(true);
      const payload = {
        amount: Number(form.amount),
        timestamp: form.timestamp,
        payer_id: form.payerId,
        payee_id: form.payeeId,
        device_id: form.deviceId,
        geo_lat: form.geoLat ? Number(form.geoLat) : null,
        geo_lon: form.geoLon ? Number(form.geoLon) : null,
        txnCountLastHour: form.txnCountLastHour ? Number(form.txnCountLastHour) : 0,
        avgTicketLast7d: form.avgTicketLast7d ? Number(form.avgTicketLast7d) : 0,
      };
      const out = await predict(payload);
      setResult(out);
    } catch (e) {
      console.error(e);
      Alert.alert("Prediction failed", String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setForm(initialForm); };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 48 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.row, s.between, { marginBottom: 14 }]}>
          <Text style={s.h1}>UPI Fraud Detector</Text>
          <View style={s.chip}><Text style={s.chipText}>{API_URL ? "API" : "MOCK"} MODE</Text></View>
        </View>

        <View style={[s.card, { marginBottom: 16 }]}>
          <Text style={s.p}>
            Enter transaction details to get a risk score (0–1). High scores indicate higher fraud likelihood.
            Framework integrates ML models, anomaly detection, and behavioral analytics for real-time alerts.
          </Text>
        </View>

        {/* FORM */}
        <View style={[s.card, { marginBottom: 16 }]}>
          <Text style={s.h2}>Transaction</Text>

          <Text style={s.label}>Amount (₹)</Text>
          <TextInput style={s.input} keyboardType="numeric" placeholderTextColor="#5E6B85" placeholder="e.g., 1500" value={form.amount} onChangeText={(t)=>setForm(f=>({...f, amount:t}))} />

          <Text style={s.label}>Timestamp (ISO)</Text>
          <TextInput style={s.input} autoCapitalize="none" placeholderTextColor="#5E6B85" value={form.timestamp} onChangeText={(t)=>setForm(f=>({...f, timestamp:t}))} />

          <Text style={s.label}>Payer ID</Text>
          <TextInput style={s.input} autoCapitalize="none" placeholderTextColor="#5E6B85" value={form.payerId} onChangeText={(t)=>setForm(f=>({...f, payerId:t}))} />

          <Text style={s.label}>Payee ID</Text>
          <TextInput style={s.input} autoCapitalize="none" placeholderTextColor="#5E6B85" value={form.payeeId} onChangeText={(t)=>setForm(f=>({...f, payeeId:t}))} />

          <Text style={s.label}>Device ID</Text>
          <TextInput style={s.input} autoCapitalize="none" placeholderTextColor="#5E6B85" value={form.deviceId} onChangeText={(t)=>setForm(f=>({...f, deviceId:t}))} />

          <View style={[s.row, s.between]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.label}>Geo Lat</Text>
              <TextInput style={s.input} keyboardType="numeric" placeholderTextColor="#5E6B85" value={form.geoLat} onChangeText={(t)=>setForm(f=>({...f, geoLat:t}))} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.label}>Geo Lon</Text>
              <TextInput style={s.input} keyboardType="numeric" placeholderTextColor="#5E6B85" value={form.geoLon} onChangeText={(t)=>setForm(f=>({...f, geoLon:t}))} />
            </View>
          </View>

          <View style={[s.row, s.between]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.label}>Txn Count (last hour)</Text>
              <TextInput style={s.input} keyboardType="numeric" placeholderTextColor="#5E6B85" value={form.txnCountLastHour} onChangeText={(t)=>setForm(f=>({...f, txnCountLastHour:t}))} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.label}>Avg Ticket (last 7d)</Text>
              <TextInput style={s.input} keyboardType="numeric" placeholderTextColor="#5E6B85" value={form.avgTicketLast7d} onChangeText={(t)=>setForm(f=>({...f, avgTicketLast7d:t}))} />
            </View>
          </View>

          <TouchableOpacity style={s.btn} onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Get Risk Score</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGhost} onPress={reset} disabled={loading}>
            <Text style={{ color: "#9FB3C8", fontWeight: "700" }}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* RESULT */}
        {result && (
          <View style={[s.card]}>            
            <View style={[s.row, s.between]}>
              <Text style={s.h2}>Result</Text>
              <Text style={[s.small, { color: labelColor, fontWeight: "800" }]}>
                {result.label === "FRAUD" ? "HIGH RISK" : "LOW RISK"}
              </Text>
            </View>
            <Text style={[s.p, { marginTop: 8 }]}>Score</Text>
            <Text style={{ color: labelColor, fontSize: 28, fontWeight: "900" }}>{fmt(result.score)}</Text>
            <Gauge score={Number(result.score || 0)} />

            {Array.isArray(result.top_features) && result.top_features.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={s.h2}>Top factors</Text>
                {result.top_features.map((f, idx) => (
                  <View key={idx} style={[s.row, s.between, { marginTop: 10 }]}>
                    <Text style={[s.p, { flex: 1 }]}>{f.name}</Text>
                    <Text style={[s.small, { width: 80, textAlign: "right" }]}>{String(f.value)}</Text>
                    <Text style={[s.small, { width: 60, textAlign: "right", color: "#9CD67C" }]}>w={fmt(f.weight)}</Text>
                  </View>
                ))}
              </View>
            )}

            {result.explanation && (
              <View style={{ marginTop: 16 }}>
                <Text style={s.h2}>Explanation</Text>
                <Text style={[s.p, { marginTop: 6 }]}>{result.explanation}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
