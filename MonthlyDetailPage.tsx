import { useEffect, useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function MonthlyDetailPage() {
  const reportRef = useRef<HTMLDivElement>(null);

  // دالة إنشاء ملف PDF
  const generatePDFFile = async () => {
    const element = reportRef.current;
    if (!element) return null;

    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], `الحساب_الشهري_${new Date().toISOString().slice(0, 10)}.pdf`, {
      type: 'application/pdf',
    });

    return { pdf, file };
  };

  // 1. تنزيل PDF
  const handleDownloadPDF = async () => {
    const result = await generatePDFFile();
    if (result) result.pdf.save(result.file.name);
  };

  // 2. مشاركة إلى التطبيقات
  const handleShareApp = async () => {
    const result = await generatePDFFile();
    if (!result) return;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [result.file] })) {
      await navigator.share({
        title: 'تقرير الحساب الشهري',
        text: 'مرفق تقرير الحساب الشهري',
        files: [result.file],
      });
    } else {
      handleDownloadPDF();
    }
  };

  // 3. مشاركة عبر واتساب
  const handleShareWhatsApp = async () => {
    if (navigator.share) {
      await handleShareApp();
    } else {
      const msg = encodeURIComponent('مرحباً، يمكنك الاطلاع على تقرير الحساب الشهري المرفق.');
      window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    }
  };

  return (
    <div style={{ padding: '15px' }}>
      {/* أزرار الحفظ والمشاركة */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <button onClick={handleDownloadPDF} style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
          📄 حفظ PDF
        </button>
        <button onClick={handleShareApp} style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
          📲 مشاركة
        </button>
        <button onClick={handleShareWhatsApp} style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#25D366', color: '#fff', border: 'none', cursor: 'pointer' }}>
          💬 واتساب
        </button>
      </div>

      {/* محتوى الحساب الشهري الذي سيتم تحويله إلى PDF */}
      <div ref={reportRef} style={{ padding: '15px', backgroundColor: '#fff', color: '#000' }}>
        <h2>تفاصيل الحساب الشهري</h2>
        {/* سيظهر جدول المحاسبة الخاص بك هنا */}
      </div>
    </div>
  );
}
