// ============================================================
// 公司資訊常數（用於報價單抬頭、PDF匯出、收款資訊）
// 資料來源：公司最新登記資料
// ============================================================
export const COMPANY_INFO = {
  nameZh: '一木工程有限公司',
  nameEn: 'One Wood Limited',
  addressZh: '九龍紅磡黃埔新邨德民街德民大廈E2舖',
  addressEn: 'Shop E2, Tak Man Building, Tak Man Street, Whampoa New Village, Hung Hom, Kowloon, Hong Kong',
  phone: '+852 9555 5124',
  website: 'onewood.com.hk',
  email: 'sales@onewood.com.hk',
  bank: {
    name: '華僑永享 OCBC',
    accountNo: '035-802156138831',
    accountName: 'One Wood Limited'
  },
  quoteValidDays: 30,
  // 香港無銷售稅（VAT/GST），報價單預設不計稅
  defaultTaxRate: 0,
  defaultCurrency: 'HKD',
  footerNote: '此報價單經雙方簽署後具有合約效力',
  invoiceFooterNote: '此發票乃根據雙方已簽署之報價單開立，為正式收款憑證'
}
