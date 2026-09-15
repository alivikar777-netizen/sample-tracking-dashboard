const SHEET_ID = "142xiSUpVUdMGkFkzvyFBCPp5M0J_0AtAdHlCsCUWqkg";

const ALLOWED_TABS = new Set([
  "All Samples",
  "Government Contract Sample",
  "Exhibitor & Attendee Samples",
  "EXhibitior Count",
  "Business Email List Samples",
  "Funding Samples",
  "Location Wise Email List",
  "Doctors - Specialist Email List",
  "Industry Email List",
  "Title Email List",
  "Technology Users Email List",
  "E-Commerce Samples"
]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const tab = Array.isArray(req.query.tab)
    ? req.query.tab[0]
    : req.query.tab;

  if (!tab || !ALLOWED_TABS.has(tab)) {
    return res.status(400).json({
      error: "Invalid sheet tab"
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const url = new URL(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`
    );

    url.searchParams.set("tqx", "out:csv");
    url.searchParams.set("sheet", tab);
    url.searchParams.set("_", Date.now().toString());

    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "Google Sheets request failed",
        status: response.status
      });
    }

    const csv = await response.text();

    if (!csv || csv.trim().length === 0) {
      return res.status(502).json({
        error: "Google Sheets returned empty data"
      });
    }

    if (/^\s*<!doctype html|^\s*<html/i.test(csv)) {
      return res.status(502).json({
        error: "Google Sheets returned HTML instead of CSV"
      });
    }

    if (csv.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        error: "Sheet response is too large"
      });
    }

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    );

    return res.status(200).send(csv);

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Google Sheets request timed out"
      });
    }

    console.error("Sheet proxy error:", error);

    return res.status(500).json({
      error: "Unable to load sheet data"
    });

  } finally {
    clearTimeout(timeout);
  }
}
