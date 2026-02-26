"use client";

export default function InvoicePrintButton() {
  return (
    <>
      <style jsx global>{`
        @media print {
          /* Hide everything by default */
          body * { visibility: hidden; }
          /* Only show the invoice sheet */
          .invoice-sheet, .invoice-sheet * { visibility: visible; }
          /* Position it at the top left */
          .invoice-sheet { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; margin: 0; padding: 0; }
          /* Hide the buttons inside the invoice */
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ textAlign: "center", marginTop: "40px" }} className="no-print">
        <button 
            onClick={() => window.print()} 
            style={{ background: "none", border: "2px solid #000", padding: "10px 30px", borderRadius: "30px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}
        >
            🖨️ Print / Download PDF
        </button>
        <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
            (Use your browser&apos;s &quot;Save as PDF&quot; option)
        </p>
      </div>
    </>
  );
}
