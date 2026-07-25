// ============================================================
// 公司資訊常數（用於報價單抬頭、PDF匯出、收款資訊）
// 資料來源：實際報價單範本 (Quotation_南昌村,昌賢樓713室0715.pdf)
// ============================================================
export const COMPANY_INFO = {
  nameZh: '一木工程有限公司',
  nameEn: 'ONE WOOD LIMITED',
  addressEn: 'Unit 1401, 14F, Wah Wai Centre, No38-40, Au Pui Wan St. Fo Tan, HK',
  phone: '9555 5124',
  contactPerson: 'Wa Tong (Sales Manager)',
  contactPhone: '6466-6293',
  bank: {
    name: '華僑永享 OCBC',
    accountNo: '035-802156138831',
    accountName: 'One Wood Limited'
  },
  quoteValidDays: 30,
  // 香港無銷售稅（VAT/GST），報價單預設不計稅
  defaultTaxRate: 0,
  defaultCurrency: 'HKD',
  footerNote: '此報價單經雙方簽署後具有合約效力'
}
