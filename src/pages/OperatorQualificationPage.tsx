import {
  useMemo,
  useState,
} from 'react';

import {
  BadgeCheck,
  CalendarDays,
  FileDown,
  HardHat,
  IdCard,
  ImagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';

import html2canvas from 'html2canvas';

import { jsPDF } from 'jspdf';

import {
  Filesystem,
  Directory,
} from '@capacitor/filesystem';

import { Share } from '@capacitor/share';

import { Capacitor } from '@capacitor/core';

import { AppLayout } from '@/components/layout/AppLayout';

type OperatorStatus =
  | 'valid'
  | 'expired'
  | 'suspended';

type OperatorCard = {
  id: string;
  cardNo: string;
  operatorName: string;
  idNumber: string;
  employer: string;
  qualificationType: string;
  equipmentType: string;
  capacityRange: string;
  issueDate: string;
  expiryDate: string;
  evaluator: string;
  status: OperatorStatus;
  verificationUrl: string;
  notes: string;
  photoDataUrl: string;
};

const STORAGE_KEY =
  'bakr_pro_operator_qualification_cards_v2';

const LEGACY_STORAGE_KEY =
  'bakr_pro_operator_qualification_cards_v1';

const inputClass =
  'w-full h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/50';

const labelClass =
  'block mb-2 text-[11px] font-black text-slate-300';

function loadCards(): OperatorCard[] {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      ) ||
      localStorage.getItem(
        LEGACY_STORAGE_KEY
      );

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((card: any) => ({
      ...card,
      photoDataUrl:
        card.photoDataUrl || '',
    }));
  } catch {
    return [];
  }
}

function nextCardNo(
  cards: OperatorCard[]
) {
  let max = 0;

  cards.forEach((card) => {
    const match =
      card.cardNo.match(
        /^OPC-\d{2}-(\d+)$/
      );

    if (match) {
      max = Math.max(
        max,
        Number(match[1])
      );
    }
  });

  const yy = String(
    new Date().getFullYear()
  ).slice(-2);

  return `OPC-${yy}-${String(
    max + 1
  ).padStart(6, '0')}`;
}

function statusLabel(
  status: OperatorStatus
) {
  if (status === 'valid') {
    return 'Valid';
  }

  if (status === 'expired') {
    return 'Expired';
  }

  return 'Suspended';
}

function statusBadgeStyle(
  status: OperatorStatus
) {
  if (status === 'valid') {
    return {
      background:
        'rgba(34,197,94,0.10)',
      color: '#86efac',
      border:
        '1px solid rgba(34,197,94,0.20)',
    };
  }

  if (status === 'expired') {
    return {
      background:
        'rgba(245,158,11,0.10)',
      color: '#fcd34d',
      border:
        '1px solid rgba(245,158,11,0.20)',
    };
  }

  return {
    background:
      'rgba(239,68,68,0.10)',
    color: '#fda4af',
    border:
      '1px solid rgba(239,68,68,0.20)',
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDisplayDate(value: string) {
  if (!value) return '-';

  const parts = String(value).split('-');

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function buildQrPlaceholder(url: string) {
  const safe = escapeHtml(
    url || 'Verification URL'
  );

  return `
    <div style="width:118px;height:118px;border:3px solid #0b0b0b;background:
      linear-gradient(90deg,#000 10%,#fff 10%,#fff 20%,#000 20%,#000 30%,#fff 30%,#fff 40%,#000 40%,#000 50%,#fff 50%,#fff 60%,#000 60%,#000 70%,#fff 70%,#fff 80%,#000 80%,#000 90%,#fff 90%),
      linear-gradient(#000 10%,#fff 10%,#fff 20%,#000 20%,#000 30%,#fff 30%,#fff 40%,#000 40%,#000 50%,#fff 50%,#fff 60%,#000 60%,#000 70%,#fff 70%,#fff 80%,#000 80%,#000 90%,#fff 90%);
      background-size:24px 24px;box-sizing:border-box;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:auto 0 0 0;background:rgba(255,255,255,.92);padding:4px 6px;text-align:center;font-size:9px;font-weight:900;color:#10233d;line-height:1.3;">SCAN TO VERIFY</div>
    </div>
    <div style="margin-top:6px;font-size:9px;line-height:1.35;color:#6b7280;word-break:break-all;max-width:118px;">${safe}</div>`;
}

function buildPdfMarkup(card: OperatorCard) {
  const photo = card.photoDataUrl
    ? `<img src="${card.photoDataUrl}" style="width:206px;height:225px;object-fit:cover;display:block;" />`
    : `<div style="width:206px;height:225px;background:#edf2f7;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:22px;font-weight:900;">PHOTO</div>`;

  const line = (
    label: string,
    value: string,
    bold = false
  ) => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px;line-height:1.2;">
      <div style="font-size:15px;font-weight:900;color:#0a0a0a;min-width:205px;">${escapeHtml(label)}</div>
      <div style="font-size:${bold ? '18px' : '15px'};font-weight:${bold ? '900' : '800'};color:#101828;flex:1;">${escapeHtml(value || '-')}</div>
    </div>`;

  return `
    <div style="width:794px;min-height:1123px;background:#f4f5f7;padding:20px 18px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#101828;">
      <div style="background:#fff;border:2px solid #cfd4dc;border-radius:24px;overflow:hidden;">
        <div style="display:grid;grid-template-columns:130px 1fr 130px;align-items:center;padding:18px 22px 14px;border-bottom:4px solid #111;gap:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:82px;height:82px;background:linear-gradient(135deg,#1ba4e4,#1476cb);clip-path:polygon(10% 90%,52% 10%,65% 10%,25% 90%);"></div>
            <div style="font-size:15px;font-weight:900;color:#1f86cc;line-height:1.05;">BAKR<br/>INSPECTION</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:44px;line-height:1;font-weight:900;color:#1e4f9b;letter-spacing:.3px;">BAKR Inspection</div>
            <div style="margin-top:6px;font-size:24px;font-weight:900;color:#111;">Khamis Mushait - Kingdom of Saudi Arabia</div>
          </div>
          <div style="display:flex;justify-content:flex-end;">
            <div style="width:84px;height:84px;border-radius:12px;background:linear-gradient(135deg,#224f9c,#0d2f69);display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;font-weight:900;">BP</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 208px;gap:0;border-bottom:4px solid #111;">
          <div style="padding:22px 26px 18px;">
            ${line('Name:', card.operatorName, true)}
            ${line('Iqama / Passport / ID No.:', card.idNumber, true)}
            ${line('Employee No.:', card.cardNo)}
            ${line('Co. Name:', card.employer, true)}
          </div>
          <div style="border-left:1px solid #d9dde4;background:#fcfcfd;display:flex;align-items:center;justify-content:center;padding:10px;">${photo}</div>
        </div>

        <div style="display:grid;grid-template-columns:145px 1fr 215px;align-items:stretch;border-bottom:4px solid #081454;">
          <div style="padding:14px 14px 10px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;">${buildQrPlaceholder(card.verificationUrl)}</div>

          <div style="padding:18px 18px 10px;border-left:1px solid #d9dde4;border-right:1px solid #d9dde4;">
            <div style="display:grid;grid-template-columns:170px 1fr;row-gap:14px;column-gap:16px;align-items:end;">
              <div style="font-size:18px;font-weight:900;">Certificate No.:</div>
              <div style="font-size:20px;font-weight:900;">${escapeHtml(card.cardNo)}</div>
              <div style="font-size:18px;font-weight:900;">Date of Issue:</div>
              <div style="font-size:22px;font-weight:900;color:#d22727;">${escapeHtml(formatDisplayDate(card.issueDate))}</div>
              <div style="font-size:18px;font-weight:900;">Expiry Date:</div>
              <div style="font-size:22px;font-weight:900;color:#d22727;">${escapeHtml(formatDisplayDate(card.expiryDate))}</div>
            </div>
          </div>

          <div style="padding:18px 18px 10px;">
            <div style="font-size:18px;font-weight:900;margin-bottom:14px;">Examiner:</div>
            <div style="height:72px;display:flex;align-items:flex-end;justify-content:center;font-family:'Brush Script MT',cursive;font-size:48px;color:#1847c0;line-height:1;">${escapeHtml(card.evaluator || 'Signature')}</div>
            <div style="margin-top:8px;font-size:15px;font-weight:900;text-align:center;">${escapeHtml(card.evaluator || 'Authorized Examiner')}</div>
          </div>
        </div>

        <div style="background:#081454;color:#fff;text-align:center;padding:12px 18px;font-size:32px;font-weight:900;line-height:1.05;">${escapeHtml(card.qualificationType || 'Mobile Crane Operator')}</div>

        <div style="background:#fff;padding:0;">
          <div style="background:#041047;color:#fff;text-align:center;padding:18px 24px;font-size:24px;font-weight:900;line-height:1.15;">The holder of this card has successfully passed the ${escapeHtml(card.qualificationType || 'Operator')} Test.</div>
          <div style="padding:18px 24px 14px;text-align:center;font-size:23px;font-weight:500;color:#111;">Capacity: ${escapeHtml(card.capacityRange || '20T - 50T')}</div>
          <div style="padding:14px 24px 18px;text-align:center;font-size:18px;font-weight:900;color:#cf2424;border-bottom:4px solid #111;">To validate please visit ${escapeHtml(card.verificationUrl || 'the verification URL')} or Scan QR Code</div>

          <div style="padding:10px 18px 12px;display:grid;grid-template-columns:110px 1fr 110px;align-items:center;gap:10px;border-bottom:4px solid #111;">
            <div style="display:flex;justify-content:center;gap:8px;">
              <div style="width:42px;height:42px;border-radius:50%;background:#d62828;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;">QC</div>
              <div style="width:42px;height:42px;border-radius:50%;border:2px solid #1f86cc;color:#1f86cc;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;">GCF</div>
            </div>
            <div style="text-align:center;line-height:1.25;">
              <div style="font-size:30px;font-weight:900;color:#1e4f9b;">BAKR Inspection</div>
              <div style="font-size:18px;">Khamis Mushait, Asir - Saudi Arabia</div>
              <div style="font-size:18px;">Tel: 0558995962</div>
              <div style="font-size:18px;">E-mail : info@bakr-inspection.com</div>
              <div style="font-size:18px;">www.bakr-inspection.com</div>
            </div>
            <div style="display:flex;justify-content:center;gap:8px;">
              <div style="width:46px;height:58px;border:2px solid #1e4f9b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#1e4f9b;font-size:14px;font-weight:900;">LMS</div>
              <div style="width:46px;height:58px;border-radius:8px;background:#1a8d55;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;">IAS</div>
            </div>
          </div>

          <div style="padding:12px 18px 18px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#cf2424;text-decoration:underline;text-underline-offset:5px;">Disclaimer</div>
            <div style="margin-top:10px;font-size:17px;line-height:1.26;color:#111;">We hereby declare that the holder of this card was examined in accordance with applicable standards and that results were satisfactory at the time of the examination. This internal company qualification card is intended for operational competency records only and does not replace any government-issued license.</div>
          </div>
        </div>
      </div>
    </div>`;
}

async function createOperatorPdf(
  card: OperatorCard
) {
  const host =
    document.createElement('div');

  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#ffffff';
  host.innerHTML = buildPdfMarkup(card);

  document.body.appendChild(host);

  try {
    const target =
      host.firstElementChild as HTMLElement;

    const canvas = await html2canvas(
      target,
      {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      }
    );

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData =
      canvas.toDataURL(
        'image/jpeg',
        0.95
      );

    const pageWidth = 210;
    const pageHeight = 297;
    const imgHeight =
      (canvas.height * pageWidth) /
      canvas.width;

    pdf.addImage(
      imgData,
      'JPEG',
      0,
      0,
      pageWidth,
      Math.min(imgHeight, pageHeight),
      undefined,
      'FAST'
    );

    return pdf;
  } finally {
    document.body.removeChild(host);
  }
}

function blobToBase64(
  blob: Blob
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = String(
          reader.result || ''
        );

        resolve(
          result.includes(',')
            ? result.split(',')[1]
            : result
        );
      };

      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }
  );
}

async function saveOperatorPdf(
  card: OperatorCard
) {
  const pdf =
    await createOperatorPdf(card);

  const safeName =
    card.operatorName
      .trim()
      .replace(
        /[^\w\u0600-\u06FF-]+/g,
        '-'
      )
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const fileName =
    `${safeName || 'Operator'}-${card.cardNo}.pdf`;

  if (Capacitor.isNativePlatform()) {
    const blob = pdf.output('blob');
    const base64 =
      await blobToBase64(blob);

    const result =
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

    await Share.share({
      title: fileName,
      text:
        `Operator Qualification PDF - ${card.operatorName}`,
      files: [result.uri],
      dialogTitle:
        'Save or open PDF',
    });

    return;
  }

  pdf.save(fileName);
}

export function OperatorQualificationPage() {
  const [cards, setCards] =
    useState<OperatorCard[]>(
      () => loadCards()
    );

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [cardNo, setCardNo] =
    useState(() =>
      nextCardNo(loadCards())
    );

  const [
    operatorName,
    setOperatorName,
  ] = useState('');

  const [idNumber, setIdNumber] =
    useState('');

  const [employer, setEmployer] =
    useState('');

  const [
    qualificationType,
    setQualificationType,
  ] = useState(
    'Mobile Crane Operator'
  );

  const [
    equipmentType,
    setEquipmentType,
  ] = useState('Mobile Crane');

  const [
    capacityRange,
    setCapacityRange,
  ] = useState('20T - 50T');

  const [issueDate, setIssueDate] =
    useState('');

  const [expiryDate, setExpiryDate] =
    useState('');

  const [evaluator, setEvaluator] =
    useState('');

  const [status, setStatus] =
    useState<OperatorStatus>('valid');

  const [
    verificationUrl,
    setVerificationUrl,
  ] = useState('');

  const [notes, setNotes] =
    useState('');

  const [
    photoDataUrl,
    setPhotoDataUrl,
  ] = useState('');

  const filteredCards = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    if (!q) return cards;

    return cards.filter((card) =>
      [
        card.cardNo,
        card.operatorName,
        card.idNumber,
        card.employer,
        card.qualificationType,
        card.equipmentType,
        card.capacityRange,
        card.evaluator,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [cards, search]);

  function persist(
    next: OperatorCard[]
  ) {
    setCards(next);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );
  }

  function resetForm(
    source = cards
  ) {
    setEditingId(null);
    setCardNo(
      nextCardNo(source)
    );
    setOperatorName('');
    setIdNumber('');
    setEmployer('');
    setQualificationType(
      'Mobile Crane Operator'
    );
    setEquipmentType(
      'Mobile Crane'
    );
    setCapacityRange(
      '20T - 50T'
    );
    setIssueDate('');
    setExpiryDate('');
    setEvaluator('');
    setStatus('valid');
    setVerificationUrl('');
    setNotes('');
    setPhotoDataUrl('');
  }

  function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(
        'Please select an image file.'
      );
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      setPhotoDataUrl(
        String(reader.result || '')
      );
    };

    reader.readAsDataURL(file);
  }

  function saveCard() {
    if (!operatorName.trim()) {
      alert('Please enter operator name.');
      return;
    }

    if (!idNumber.trim()) {
      alert(
        'Please enter ID / Iqama number.'
      );
      return;
    }

    if (
      !issueDate ||
      !expiryDate
    ) {
      alert(
        'Please select issue and expiry dates.'
      );
      return;
    }

    const card: OperatorCard = {
      id:
        editingId ??
        String(Date.now()),
      cardNo:
        cardNo.trim().toUpperCase(),
      operatorName:
        operatorName.trim(),
      idNumber:
        idNumber.trim(),
      employer:
        employer.trim(),
      qualificationType:
        qualificationType.trim(),
      equipmentType:
        equipmentType.trim(),
      capacityRange:
        capacityRange.trim(),
      issueDate,
      expiryDate,
      evaluator:
        evaluator.trim(),
      status,
      verificationUrl:
        verificationUrl.trim(),
      notes: notes.trim(),
      photoDataUrl,
    };

    const next =
      editingId === null
        ? [card, ...cards]
        : cards.map((item) =>
            item.id === editingId
              ? card
              : item
          );

    persist(next);
    resetForm(next);

    alert(
      editingId
        ? 'Card updated successfully.'
        : 'Card saved successfully.'
    );
  }

  function editCard(
    card: OperatorCard
  ) {
    setEditingId(card.id);
    setCardNo(card.cardNo);
    setOperatorName(
      card.operatorName
    );
    setIdNumber(card.idNumber);
    setEmployer(card.employer);
    setQualificationType(
      card.qualificationType
    );
    setEquipmentType(
      card.equipmentType
    );
    setCapacityRange(
      card.capacityRange
    );
    setIssueDate(card.issueDate);
    setExpiryDate(
      card.expiryDate
    );
    setEvaluator(card.evaluator);
    setStatus(card.status);
    setVerificationUrl(
      card.verificationUrl
    );
    setNotes(card.notes);
    setPhotoDataUrl(
      card.photoDataUrl || ''
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function deleteCard(id: string) {
    if (
      !window.confirm(
        'Do you want to delete this card?'
      )
    ) {
      return;
    }

    const next = cards.filter(
      (item) => item.id !== id
    );

    persist(next);

    if (editingId === id) {
      resetForm(next);
    }
  }

  async function handleSavePdf(
    card: OperatorCard
  ) {
    try {
      await saveOperatorPdf(card);
    } catch (error) {
      console.error(
        'PDF save error:',
        error
      );

      alert(
        'Could not create PDF. Please try again.'
      );
    }
  }

  return (
    <AppLayout>
      <div
        dir="ltr"
        className="w-full pb-8"
      >
        <section
          className="rounded-[26px] p-5 mb-5"
          style={{
            background:
              'linear-gradient(135deg,#0b1a2c,#102b46 62%,#162032)',
            border:
              '1px solid rgba(245,158,11,0.18)',
            boxShadow:
              '0 16px 38px rgba(0,0,0,0.20)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center shrink-0 bg-amber-400/10 border border-amber-400/20">
              <HardHat className="w-9 h-9 text-amber-400" />
            </div>

            <div>
              <p className="text-[10px] text-amber-400 font-black tracking-[0.16em]">
                BAKR PRO
              </p>

              <h1 className="text-[22px] font-black text-white mt-1">
                Operator Qualification Card
              </h1>

              <p className="text-[11px] text-slate-400 mt-1">
                Internal Training &
                Qualification Record
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl px-3 py-2 bg-sky-400/5 border border-sky-400/10">
            <p className="text-[9px] leading-5 text-slate-400">
              Internal training and
              qualification record inside
              BAKR PRO — not a government
              license.
            </p>
          </div>
        </section>

        <section
          className="rounded-[24px] p-4 mb-5"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.98),rgba(7,17,31,0.99))',
            border:
              '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelClass}>
                Operator Photo
              </label>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-24 h-24 rounded-[18px] overflow-hidden border border-white/10 bg-slate-950/60 flex items-center justify-center">
                  {photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt="Operator"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserRound className="w-10 h-10 text-slate-600" />
                  )}
                </div>

                <div className="flex-1 min-w-[220px]">
                  <label className="h-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handlePhotoChange
                      }
                      className="hidden"
                    />
                  </label>

                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoDataUrl('')
                      }
                      className="mt-2 h-10 px-4 rounded-xl bg-red-500/10 border border-red-400/15 text-red-300 text-xs font-bold"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Card Number
              </label>
              <input
                className={inputClass}
                value={cardNo}
                onChange={(e) =>
                  setCardNo(
                    e.target.value
                  )
                }
                placeholder="OPC-26-000001"
              />
            </div>

            <div>
              <label className={labelClass}>
                Operator Name
              </label>
              <input
                className={inputClass}
                value={operatorName}
                onChange={(e) =>
                  setOperatorName(
                    e.target.value
                  )
                }
                placeholder="Operator Name"
              />
            </div>

            <div>
              <label className={labelClass}>
                ID / Iqama Number
              </label>
              <input
                className={inputClass}
                value={idNumber}
                onChange={(e) =>
                  setIdNumber(
                    e.target.value
                  )
                }
                placeholder="ID / Iqama Number"
              />
            </div>

            <div>
              <label className={labelClass}>
                Employer / Company
              </label>
              <input
                className={inputClass}
                value={employer}
                onChange={(e) =>
                  setEmployer(
                    e.target.value
                  )
                }
                placeholder="Company Name"
              />
            </div>

            <div>
              <label className={labelClass}>
                Qualification Type
              </label>
              <input
                className={inputClass}
                value={
                  qualificationType
                }
                onChange={(e) =>
                  setQualificationType(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                Equipment Type
              </label>
              <input
                className={inputClass}
                value={equipmentType}
                onChange={(e) =>
                  setEquipmentType(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                Capacity Range
              </label>
              <input
                className={inputClass}
                value={capacityRange}
                onChange={(e) =>
                  setCapacityRange(
                    e.target.value
                  )
                }
                placeholder="20T - 50T"
              />
            </div>

            <div>
              <label className={labelClass}>
                Inspector / Evaluator
              </label>
              <input
                className={inputClass}
                value={evaluator}
                onChange={(e) =>
                  setEvaluator(
                    e.target.value
                  )
                }
                placeholder="Inspector Name"
              />
            </div>

            <div>
              <label className={labelClass}>
                Issue Date
              </label>
              <input
                type="date"
                className={inputClass}
                value={issueDate}
                onChange={(e) =>
                  setIssueDate(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                Expiry Date
              </label>
              <input
                type="date"
                className={inputClass}
                value={expiryDate}
                onChange={(e) =>
                  setExpiryDate(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                Status
              </label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target
                      .value as OperatorStatus
                  )
                }
              >
                <option value="valid">
                  Valid
                </option>
                <option value="expired">
                  Expired
                </option>
                <option value="suspended">
                  Suspended
                </option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Verification URL
              </label>
              <input
                dir="ltr"
                className={inputClass}
                value={
                  verificationUrl
                }
                onChange={(e) =>
                  setVerificationUrl(
                    e.target.value
                  )
                }
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                Notes
              </label>
              <textarea
                className="w-full min-h-[90px] rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/50"
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                placeholder="Notes"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={saveCard}
              className="h-12 px-5 rounded-2xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <Save className="w-4 h-4" />
              {editingId
                ? 'Update Card'
                : 'Save Card'}
            </button>

            <button
              type="button"
              onClick={() =>
                resetForm()
              }
              className="h-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </section>

        <section
          className="rounded-[24px] p-4"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.98),rgba(7,17,31,0.99))',
            border:
              '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-black text-white">
                Operator Cards
              </h2>
              <p className="text-[9px] text-slate-500 mt-1">
                {cards.length} saved record(s)
              </p>
            </div>

            <div className="relative flex-1 max-w-[230px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                className="w-full h-10 rounded-xl border border-white/10 bg-slate-950/60 pl-9 pr-3 text-[11px] text-white outline-none"
                placeholder="Search..."
              />
            </div>
          </div>

          {filteredCards.length ===
          0 ? (
            <div className="py-12 text-center">
              <BadgeCheck className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-400 mt-3">
                No saved cards yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map(
                (card) => (
                  <article
                    key={card.id}
                    className="rounded-[20px] p-4 bg-white/[0.035] border border-white/[0.075]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-amber-400/10 flex items-center justify-center shrink-0 border border-white/10">
                        {card.photoDataUrl ? (
                          <img
                            src={
                              card.photoDataUrl
                            }
                            alt={
                              card.operatorName
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserRound className="w-6 h-6 text-amber-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-[14px] font-black text-white">
                              {
                                card.operatorName
                              }
                            </h3>
                            <p
                              className="text-[10px] text-amber-300 mt-0.5"
                              dir="ltr"
                            >
                              {card.cardNo}
                            </p>
                          </div>

                          <span
                            className="px-2.5 py-1 rounded-full text-[9px] font-black"
                            style={statusBadgeStyle(
                              card.status
                            )}
                          >
                            {statusLabel(
                              card.status
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[10px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <IdCard className="w-3.5 h-3.5" />
                            <span>
                              {
                                card.idNumber
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <HardHat className="w-3.5 h-3.5" />
                            <span>
                              {
                                card.qualificationType
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>
                              {
                                card.capacityRange
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span dir="ltr">
                              {
                                card.issueDate
                              }{' '}
                              →{' '}
                              {
                                card.expiryDate
                              }
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              handleSavePdf(card)
                            }
                            className="h-9 px-3 rounded-xl bg-amber-400/10 border border-amber-400/20 text-[10px] font-black text-amber-300 flex items-center gap-1"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            Save PDF
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              editCard(card)
                            }
                            className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteCard(
                                card.id
                              )
                            }
                            className="h-9 px-3 rounded-xl bg-red-500/10 border border-red-400/15 text-[10px] font-black text-red-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
