// ============================================================
// 公司資訊常數（前端用，供報價詳情頁 / PDF 匯出顯示）
// 對應後端 src/types/company.ts，資料來源：公司最新登記資料
// ============================================================
const COMPANY_INFO = {
  nameZh: '一木工程有限公司',
  nameEn: 'One Wood Limited',
  addressZh: '九龍紅磡黃埔新邨德民街德民大廈E2舖',
  addressEn: 'Shop E2, Tak Man Building, Tak Man Street, Whampoa New Village, Hung Hom, Kowloon, Hong Kong',
  phone: '+852 9555 5124',
  website: 'onewood.com.hk',
  email: 'sales@onewood.com.hk',
  bank: {
    name: '中國銀行 BOC (012)',
    nameEn: 'Bank of China (Hong Kong) (012)',
    accountNo: '012-91820804309',
    accountName: 'One Wood Limited',
    fpsPhone: '95555124'
  },
  bank2: {
    name: '華僑永享 OCBC (035)',
    nameEn: 'OCBC Wing Hang Bank (035)',
    accountNo: '802156138831',
    accountName: 'One Wood Limited',
    fpsId: '156138831'
  },
  quoteValidDays: 30,
  footerNote: '此報價單經雙方簽署後具有合約效力',
  footerNoteEn: 'This quotation is contractually binding once signed by both parties',
  invoiceFooterNote: '此發票乃根據雙方已簽署之報價單開立，為正式收款憑證',
  invoiceFooterNoteEn: 'This invoice is issued based on the quotation signed by both parties and serves as an official payment receipt'
}
