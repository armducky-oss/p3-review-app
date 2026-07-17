import React from "react";
import { createRoot } from "react-dom/client";
import P3ReviewApp from "./P3ReviewApp.jsx";

// storage shim (IndexedDB + localStorage) — works in Android WebView
(function () {
  if (window.storage) return;
  var LS_OK = false;
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); LS_OK = true; } catch (e) {}
  var mem = {}; var dbP = null;
  function openDB() { if (dbP) return dbP; dbP = new Promise(function (res) { try { var r = indexedDB.open("p3review-db", 1); r.onupgradeneeded = function () { r.result.createObjectStore("kv"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); return dbP; }
  function idbGet(k) { return openDB().then(function (db) { if (!db) return null; return new Promise(function (res) { try { var tx = db.transaction("kv", "readonly").objectStore("kv").get(k); tx.onsuccess = function () { res(tx.result == null ? null : tx.result); }; tx.onerror = function () { res(null); }; } catch (e) { res(null); } }); }); }
  function idbSet(k, v) { return openDB().then(function (db) { if (!db) return; return new Promise(function (res) { try { var tx = db.transaction("kv", "readwrite").objectStore("kv").put(v, k); tx.onsuccess = function () { res(); }; tx.onerror = function () { res(); }; } catch (e) { res(); } }); }); }
  window.storage = {
    get: function (k) { if (LS_OK) { var v = null; try { v = localStorage.getItem(k); } catch (e) {} if (v != null) return Promise.resolve({ key: k, value: v }); } return idbGet(k).then(function (v) { if (v != null) { if (LS_OK) { try { localStorage.setItem(k, v); } catch (e) {} } return { key: k, value: v }; } if (mem[k] != null) return { key: k, value: mem[k] }; return null; }); },
    set: function (k, v) { mem[k] = v; if (LS_OK) { try { localStorage.setItem(k, v); } catch (e) {} } idbSet(k, v); return Promise.resolve({ key: k, value: v }); },
    delete: function (k) { delete mem[k]; if (LS_OK) { try { localStorage.removeItem(k); } catch (e) {} } idbSet(k, null); return Promise.resolve({ key: k, deleted: true }); },
    list: function () { return Promise.resolve({ keys: [] }); }
  };
})();

createRoot(document.getElementById("root")).render(React.createElement(P3ReviewApp));
