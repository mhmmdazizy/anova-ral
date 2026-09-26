"use client";

import React, { useState, useEffect } from "react";
import {
  Calculator,
  Table as TableIcon,
  RefreshCw,
  BookOpen,
  Info,
  FileText,
  Tag,
  Save,
  FolderOpen,
} from "lucide-react";
import { jStat } from "jstat";

// Tipe data observasi
type OberservationData = {
  factorA: number;
  factorB: number;
  replicate: number;
  value: string;
};

// Tipe hasil dari ANOVA
type AnovaMetrics = {
  source: string;
  db: number;
  jk: number;
  kt: number | null;
  fHitung: number | null;
  f5: number | null;
  f1: number | null;
  key: string;
};

export default function AnovaCalculator() {
  // State Konfigurasi & Label
  const [levelA, setLevelA] = useState<number>(3);
  const [levelB, setLevelB] = useState<number>(3);
  const [replications, setReplications] = useState<number>(3);
  const [decimalPlaces, setDecimalPlaces] = useState<number>(3);
  const [labelA, setLabelA] = useState<string>("Faktor A");
  const [labelB, setLabelB] = useState<string>("Faktor B");

  const [data, setData] = useState<OberservationData[]>([]);
  const [results, setResults] = useState<AnovaMetrics[] | null>(null);
  const [showFormulas, setShowFormulas] = useState<boolean>(true);

  // State UX untuk fitur Save/Load Multi-Slot
  const [selectedSlot, setSelectedSlot] = useState<string>("Slot_1");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Inisialisasi/Reset Grid Input
  const handleGenerateGrid = () => {
    const newData: OberservationData[] = [];
    for (let i = 0; i < levelA; i++) {
      for (let j = 0; j < levelB; j++) {
        for (let k = 0; k < replications; k++) {
          newData.push({ factorA: i, factorB: j, replicate: k, value: "" });
        }
      }
    }
    setData(newData);
    setResults(null);
  };

  const handleInputChange = (
    factorA: number,
    factorB: number,
    replicate: number,
    val: string,
  ) => {
    setData((prev) =>
      prev.map((item) =>
        item.factorA === factorA &&
        item.factorB === factorB &&
        item.replicate === replicate
          ? { ...item, value: val }
          : item,
      ),
    );
  };

  // --- FITUR PASTE DARI EXCEL ---
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startFactorA: number,
    startFactorB: number,
    startReplicate: number,
  ) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    if (!pasteData) return;

    // Pisahkan baris (\n) dan kolom (\t) dari format Excel
    const rows = pasteData.split(/\r?\n/).map((row) => row.split("\t"));

    setData((prev) => {
      const newData = [...prev];

      // Buat pemetaan index baris secara berurutan agar sesuai dengan UI tabel
      const rowMappings: { a: number; b: number }[] = [];
      for (let a = 0; a < levelA; a++) {
        for (let b = 0; b < levelB; b++) {
          rowMappings.push({ a, b });
        }
      }

      // Cari baris mulai
      const startRowIdx = rowMappings.findIndex(
        (r) => r.a === startFactorA && r.b === startFactorB,
      );
      if (startRowIdx === -1) return prev;

      rows.forEach((rowData, rIdx) => {
        const targetRow = rowMappings[startRowIdx + rIdx];
        if (!targetRow) return; // Jika paste melebihi jumlah baris yang ada

        rowData.forEach((cellValue, cIdx) => {
          const targetCol = startReplicate + cIdx;
          if (targetCol < replications) {
            // Pastikan tidak melebihi kolom ulangan
            const dataIdx = newData.findIndex(
              (d) =>
                d.factorA === targetRow.a &&
                d.factorB === targetRow.b &&
                d.replicate === targetCol,
            );

            // Hapus spasi dan koma Excel, ganti jadi format titik untuk float
            const cleanValue = cellValue.trim().replace(",", ".");

            if (dataIdx !== -1 && cleanValue !== "") {
              newData[dataIdx] = { ...newData[dataIdx], value: cleanValue };
            }
          }
        });
      });

      return newData;
    });
  };
  // ------------------------------

  // --- FITUR LOCALSTORAGE (MULTI-SLOT) ---
  const saveToLocalStorage = () => {
    try {
      const stateToSave = {
        levelA,
        levelB,
        replications,
        decimalPlaces,
        labelA,
        labelB,
        data,
      };
      localStorage.setItem(
        `anova_workspace_${selectedSlot}`,
        JSON.stringify(stateToSave),
      );

      const slotName = selectedSlot.replace("_", " ");
      setSaveStatus(`Tersimpan di ${slotName}!`);
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error("Gagal menyimpan data:", error);
      setSaveStatus("Gagal menyimpan");
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const savedData = localStorage.getItem(`anova_workspace_${selectedSlot}`);
      const slotName = selectedSlot.replace("_", " ");

      if (savedData) {
        const parsed = JSON.parse(savedData);
        setLevelA(parsed.levelA || 3);
        setLevelB(parsed.levelB || 3);
        setReplications(parsed.replications || 3);
        setDecimalPlaces(parsed.decimalPlaces ?? 3);
        setLabelA(parsed.labelA || "Faktor A");
        setLabelB(parsed.labelB || "Faktor B");
        setData(parsed.data || []);
        setResults(null);

        setSaveStatus(`Data ${slotName} Dimuat!`);
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus(`${slotName} masih kosong`);
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (error) {
      console.error("Gagal memuat data:", error);
      setSaveStatus("Gagal memuat data");
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };
  // --------------------------

  // Perhitungan Utama ANOVA
  const processAnova = () => {
    if (data.length === 0) return;

    const currentA = levelA;
    const currentB = levelB;
    const currentReps = replications;

    const validData = data
      .filter(
        (d) =>
          d.factorA < currentA &&
          d.factorB < currentB &&
          d.replicate < currentReps,
      )
      .map((d) => ({ ...d, value: parseFloat(d.value) || 0 }));

    let grandTotal = 0;
    let sumOfSquaresTotal = 0;
    const totalN = currentA * currentB * currentReps;

    const sumA = Array(currentA).fill(0);
    const sumB = Array(currentB).fill(0);
    const sumAB = Array.from({ length: currentA }, () =>
      Array(currentB).fill(0),
    );

    validData.forEach((d) => {
      grandTotal += d.value;
      sumOfSquaresTotal += d.value * d.value;
      sumA[d.factorA] += d.value;
      sumB[d.factorB] += d.value;
      sumAB[d.factorA][d.factorB] += d.value;
    });

    const dbA = currentA - 1;
    const dbB = currentB - 1;
    const dbAB = dbA * dbB;
    const dbTreatment = currentA * currentB - 1;
    const dbError = currentA * currentB * (currentReps - 1);
    const dbTotal = totalN - 1;

    const FK = (grandTotal * grandTotal) / totalN;
    const JKT = sumOfSquaresTotal - FK;

    let sumSqAB = 0;
    for (let i = 0; i < currentA; i++) {
      for (let j = 0; j < currentB; j++) {
        sumSqAB += sumAB[i][j] * sumAB[i][j];
      }
    }
    const JKP = sumSqAB / currentReps - FK;

    const sumSqA = sumA.reduce((acc, val) => acc + val * val, 0);
    const JKA = sumSqA / (currentB * currentReps) - FK;

    const sumSqB = sumB.reduce((acc, val) => acc + val * val, 0);
    const JKB = sumSqB / (currentA * currentReps) - FK;

    const JKAB = JKP - JKA - JKB;
    const JKError = JKT - JKP;

    const KTA = JKA / dbA;
    const KTB = JKB / dbB;
    const KTAB = JKAB / dbAB;
    const KTError = JKError / dbError;
    const KTP = JKP / dbTreatment;

    const FA = KTA / KTError;
    const FB = KTB / KTError;
    const FAB = KTAB / KTError;
    const FP = KTP / KTError;

    const getFTable = (prob: number, df1: number, df2: number) => {
      if (df1 <= 0 || df2 <= 0) return null;
      return jStat.centralF.inv(prob, df1, df2);
    };

    setResults([
      {
        source: "Perlakuan (Kombinasi)",
        db: dbTreatment,
        jk: JKP,
        kt: KTP,
        fHitung: FP,
        f5: getFTable(0.95, dbTreatment, dbError),
        f1: getFTable(0.99, dbTreatment, dbError),
        key: "perlakuan",
      },
      {
        source: labelA || "Faktor A",
        db: dbA,
        jk: JKA,
        kt: KTA,
        fHitung: FA,
        f5: getFTable(0.95, dbA, dbError),
        f1: getFTable(0.99, dbA, dbError),
        key: "faktorA",
      },
      {
        source: labelB || "Faktor B",
        db: dbB,
        jk: JKB,
        kt: KTB,
        fHitung: FB,
        f5: getFTable(0.95, dbB, dbError),
        f1: getFTable(0.99, dbB, dbError),
        key: "faktorB",
      },
      {
        source: `Interaksi (${labelA || "A"} x ${labelB || "B"})`,
        db: dbAB,
        jk: JKAB,
        kt: KTAB,
        fHitung: FAB,
        f5: getFTable(0.95, dbAB, dbError),
        f1: getFTable(0.99, dbAB, dbError),
        key: "interaksi",
      },
      {
        source: "Galat",
        db: dbError,
        jk: JKError,
        kt: KTError,
        fHitung: null,
        f5: null,
        f1: null,
        key: "galat",
      },
      {
        source: "Total",
        db: dbTotal,
        jk: JKT,
        kt: null,
        fHitung: null,
        f5: null,
        f1: null,
        key: "total",
      },
    ]);
  };

  const getNotation = (
    fHitung: number | null,
    f5: number | null,
    f1: number | null,
  ) => {
    if (fHitung === null || f5 === null || f1 === null) return "";
    if (fHitung > f1) return "**";
    if (fHitung > f5) return "*";
    return "tn";
  };

  const generateReportText = (sourceName: string, notation: string) => {
    if (notation === "**") return `memberikan pengaruh sangat nyata`;
    if (notation === "*") return `memberikan pengaruh nyata`;
    return `tidak memberikan pengaruh nyata`;
  };

  const formatNumber = (num: number | null) => {
    if (num === null) return "-";
    if (Number.isInteger(num)) return num.toString();
    return Number(num.toFixed(decimalPlaces)).toString();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
              <Calculator size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Sistem Analisis Sidik Ragam (ANOVA)
              </h1>
              <p className="text-slate-500 text-sm">
                Perhitungan otomatis untuk RAL Faktorial
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm relative">
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Slot_1">Slot 1</option>
              <option value="Slot_2">Slot 2</option>
              <option value="Slot_3">Slot 3</option>
              <option value="Slot_4">Slot 4</option>
              <option value="Slot_5">Slot 5</option>
            </select>

            <button
              onClick={loadFromLocalStorage}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
              title="Muat data dari slot terpilih"
            >
              <FolderOpen size={16} className="mr-2 text-slate-600" /> Muat
            </button>
            <button
              onClick={saveToLocalStorage}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition"
              title="Simpan data ke slot terpilih"
            >
              <Save size={16} className="mr-2" /> Simpan
            </button>

            {/* Status Toast Indicator */}
            {saveStatus && (
              <div className="absolute -bottom-10 right-0 bg-slate-800 text-white text-xs px-3 py-1.5 rounded shadow-lg animate-in fade-in slide-in-from-top-2 z-50 whitespace-nowrap">
                {saveStatus}
              </div>
            )}
          </div>
        </header>

        {/* Input Konfigurasi & Label */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <TableIcon size={18} className="mr-2 text-blue-600" />
            Parameter Eksperimen & Labeling
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <h3 className="font-medium flex items-center text-slate-700">
                <Tag size={16} className="mr-2 text-slate-400" /> Pengaturan
                Faktor A
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Nama Label
                  </label>
                  <input
                    type="text"
                    value={labelA}
                    onChange={(e) => setLabelA(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Mis: Amelioran"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Jumlah Taraf (Level)
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={levelA}
                    onChange={(e) => setLevelA(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <h3 className="font-medium flex items-center text-slate-700">
                <Tag size={16} className="mr-2 text-slate-400" /> Pengaturan
                Faktor B
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Nama Label
                  </label>
                  <input
                    type="text"
                    value={labelB}
                    onChange={(e) => setLabelB(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Mis: Mikroba"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Jumlah Taraf (Level)
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={levelB}
                    onChange={(e) => setLevelB(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 md:w-1/2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Jumlah Ulangan (Replikasi)
              </label>
              <input
                type="number"
                min={2}
                value={replications}
                onChange={(e) => setReplications(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Presisi Desimal (Hasil)
              </label>
              <input
                type="number"
                min={0}
                max={6}
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateGrid}
            className="inline-flex items-center bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition"
          >
            <RefreshCw size={16} className="mr-2" />
            Buat / Reset Tabel Data
          </button>
        </section>

        {/* Tabel Input Observasi */}
        {data.length > 0 && (
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto animate-in fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Input Data Pengamatan</h2>
              <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                💡 Tips: Kamu bisa <strong>Copy</strong> data dari Excel dan{" "}
                <strong>Paste (Ctrl+V)</strong> langsung di kotak pertama!
              </span>
            </div>

            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="p-3 font-semibold text-slate-700">
                    Perlakuan ({labelA || "A"} - {labelB || "B"})
                  </th>
                  {Array.from({ length: replications }).map((_, i) => (
                    <th
                      key={`rep-${i}`}
                      className="p-3 font-semibold text-slate-700"
                    >
                      Ulangan {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: levelA }).map((_, i) =>
                  Array.from({ length: levelB }).map((_, j) => (
                    <tr
                      key={`row-${i}-${j}`}
                      className="border-b border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="p-3 font-medium text-slate-800">
                        {(labelA || "A").charAt(0)}
                        {i} - {(labelB || "B").charAt(0)}
                        {j}
                      </td>
                      {Array.from({ length: replications }).map((_, k) => {
                        const cellData = data.find(
                          (d) =>
                            d.factorA === i &&
                            d.factorB === j &&
                            d.replicate === k,
                        );
                        return (
                          <td key={`cell-${i}-${j}-${k}`} className="p-2">
                            <input
                              type="text"
                              value={cellData?.value || ""}
                              onChange={(e) =>
                                handleInputChange(i, j, k, e.target.value)
                              }
                              onPaste={(e) => handlePaste(e, i, j, k)}
                              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="0"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>

            <button
              onClick={processAnova}
              className="mt-6 w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition shadow-md"
            >
              Proses Analisis ANOVA
            </button>
          </section>
        )}

        {/* Hasil Analisis & Pembelajaran */}
        {results && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Tabel ANOVA Final */}
            <section className="bg-white p-6 rounded-xl border border-indigo-200 shadow-lg ring-1 ring-indigo-50">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-lg font-bold text-indigo-900">
                    Tabel Sidik Ragam & Pengujian Otomatis
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    F-Tabel dihitung presisi secara matematis menggunakan
                    library jStat.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto pb-4">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-50 text-indigo-900 border-b border-indigo-200">
                      <th className="p-3 font-semibold rounded-tl-lg whitespace-nowrap">
                        Sumber Keragaman
                      </th>
                      <th className="p-3 font-semibold text-center">DB</th>
                      <th className="p-3 font-semibold">JK</th>
                      <th className="p-3 font-semibold">KT</th>
                      <th className="p-3 font-semibold">F-Hitung</th>
                      <th className="p-3 font-semibold">F-Tabel 5%</th>
                      <th className="p-3 font-semibold">F-Tabel 1%</th>
                      <th className="p-3 font-semibold rounded-tr-lg text-center">
                        Notasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {results.map((res) => {
                      const notation = getNotation(res.fHitung, res.f5, res.f1);
                      const isBaseRow =
                        res.key === "galat" || res.key === "total";
                      const isTreatment = res.key === "perlakuan";

                      return (
                        <tr
                          key={res.key}
                          className={`transition ${
                            isBaseRow
                              ? "bg-slate-50"
                              : isTreatment
                                ? "bg-slate-50/50 text-slate-400"
                                : "hover:bg-indigo-50/30"
                          }`}
                        >
                          <td
                            className={`p-3 text-slate-800 ${
                              isBaseRow ? "font-medium" : ""
                            } ${isTreatment ? "text-slate-400 italic" : ""}`}
                          >
                            <div className="flex items-center">
                              {res.source}
                              {isTreatment && (
                                <div className="relative ml-2 group cursor-pointer">
                                  <Info
                                    size={14}
                                    className="text-slate-400 hover:text-indigo-500 transition-colors"
                                  />

                                  <div
                                    className="
      absolute
      left-1/2
      -translate-x-1/2
      top-full
      mt-2
      hidden
      group-hover:block
      w-48
      p-2.5
      bg-slate-800
      text-white
      text-xs
      rounded-md
      shadow-xl
      z-50
      text-center
      leading-relaxed
    "
                                  >
                                    Biasanya diabaikan karena fokus pada
                                    pengaruh faktor A, B, dan interaksi.
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td
                            className={`p-3 text-center ${isTreatment ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {res.db}
                          </td>
                          <td
                            className={`p-3 font-mono ${isTreatment ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {formatNumber(res.jk)}
                          </td>
                          <td
                            className={`p-3 font-mono ${isTreatment ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {formatNumber(res.kt)}
                          </td>
                          <td
                            className={`p-3 font-mono ${isTreatment ? "text-slate-400" : "font-bold text-indigo-700"}`}
                          >
                            {formatNumber(res.fHitung)}
                          </td>
                          <td
                            className={`p-3 font-mono ${isTreatment ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {formatNumber(res.f5)}
                          </td>
                          <td
                            className={`p-3 font-mono ${isTreatment ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {formatNumber(res.f1)}
                          </td>
                          <td className="p-3 text-center">
                            {!isBaseRow && (
                              <span
                                className={`inline-block px-2 py-1 rounded font-bold text-xs ${
                                  notation === "**"
                                    ? "bg-green-100 text-green-700"
                                    : notation === "*"
                                      ? "bg-blue-100 text-blue-700"
                                      : notation === "tn"
                                        ? "bg-slate-200 text-slate-500"
                                        : "text-transparent"
                                } ${isTreatment ? "opacity-50 grayscale" : ""}`}
                              >
                                {notation}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legenda & Draf Kesimpulan */}
              <div className="mt-6 flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-2/3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center">
                    <FileText size={16} className="mr-1.5 text-emerald-600" />{" "}
                    Kesimpulan Naratif
                  </h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
                    {results
                      .filter((r) =>
                        ["faktorA", "faktorB", "interaksi"].includes(r.key),
                      )
                      .map((res) => {
                        const notation = getNotation(
                          res.fHitung,
                          res.f5,
                          res.f1,
                        );
                        return (
                          <li key={`kesimpulan-${res.key}`}>
                            Perlakuan <strong>{res.source}</strong>{" "}
                            {generateReportText(res.source, notation)}.
                          </li>
                        );
                      })}
                  </ul>
                </div>

                <div className="w-full md:w-1/3 bg-white p-4 rounded-lg border border-slate-100 flex flex-col justify-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800 mb-1">
                    Legenda Notasi:
                  </span>
                  <span className="flex items-center">
                    <span className="w-6 font-bold text-green-700">**</span>{" "}
                    Sangat Nyata (F-Hitung {">"} F-Tabel 1%)
                  </span>
                  <span className="flex items-center">
                    <span className="w-6 font-bold text-blue-700">*</span> Nyata
                    (F-Hitung {">"} F-Tabel 5%)
                  </span>
                  <span className="flex items-center">
                    <span className="w-6 font-bold text-slate-500">tn</span>{" "}
                    Tidak Nyata (F-Hitung {"<"} F-Tabel 5%)
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-indigo-100 pt-4 flex justify-end">
                <button
                  onClick={() => setShowFormulas(!showFormulas)}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  <BookOpen size={16} className="mr-1.5" />
                  {showFormulas
                    ? "Sembunyikan Panduan Rumus"
                    : "Tampilkan Panduan Rumus"}
                </button>
              </div>
            </section>

            {/* Edukasi & Rumus */}
            {showFormulas && (
              <section className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center border-b border-blue-200 pb-3">
                  <Info size={20} className="mr-2" />
                  Panduan Belajar: Rumus RAL Faktorial (2 Faktor)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                  {/* Bagian Kiri */}
                  <div className="space-y-5">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-2">
                        1. Faktor Koreksi (FK)
                      </h4>
                      <code className="block bg-slate-50 p-2 rounded text-blue-700 font-mono text-xs">
                        FK = (Total Seluruh Nilai)² / (a × b × r)
                      </code>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-2">
                        2. Derajat Bebas (DB)
                      </h4>
                      <ul className="space-y-2 text-slate-600">
                        <li>
                          <strong>DB Perlakuan</strong> = (a × b) - 1
                        </li>
                        <li>
                          <strong>DB {labelA || "Faktor A"}</strong> = a - 1
                        </li>
                        <li>
                          <strong>DB {labelB || "Faktor B"}</strong> = b - 1
                        </li>
                        <li>
                          <strong>DB Interaksi</strong> = (a - 1) × (b - 1)
                        </li>
                        <li>
                          <strong>DB Galat</strong> = (a × b) × (r - 1)
                        </li>
                        <li>
                          <strong>DB Total</strong> = (a × b × r) - 1
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Bagian Kanan */}
                  <div className="space-y-5">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-2">
                        3. Jumlah Kuadrat (JK)
                      </h4>
                      <ul className="space-y-3 text-slate-600">
                        <li>
                          <strong>JK Perlakuan (JKP)</strong> = [ (Σ Nilai tiap
                          kombinasi)² / r ] - FK
                        </li>
                        <li>
                          <strong>JK {labelA || "Faktor A"} (JKA)</strong> = [
                          (Σ Nilai tiap level A)² / (b × r) ] - FK
                        </li>
                        <li>
                          <strong>JK {labelB || "Faktor B"} (JKB)</strong> = [
                          (Σ Nilai tiap level B)² / (a × r) ] - FK
                        </li>
                        <li>
                          <strong>JK Interaksi (JKAB)</strong> = JKP - JKA - JKB
                        </li>
                        <li>
                          <strong>JK Galat (Error)</strong> = JKT - JKP
                        </li>
                        <li>
                          <strong>JK Total (JKT)</strong> = (Σ Seluruh Nilai²) -
                          FK
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-2">
                        4. Kuadrat Tengah (KT) & F-Hitung
                      </h4>
                      <code className="block bg-slate-50 p-2 rounded text-blue-700 font-mono text-xs mb-2">
                        KT = JK / DB
                      </code>
                      <code className="block bg-slate-50 p-2 rounded text-emerald-700 font-mono text-xs font-bold">
                        F-Hitung = KT (Sumber Keragaman) / KT (Galat)
                      </code>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
