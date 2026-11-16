from pathlib import Path
from PIL import Image
import openpyxl,xml.etree.ElementTree as ET
root=Path('data entry/products'); errors=[]; n=0
for book in root.glob('*/*/product.xlsx'):
    n+=1; ws=openpyxl.load_workbook(book,read_only=True).active
    rows=list(ws.values); fields={a:b for a,b in rows[1:]}
    for key in ['نام','توضیح کوتاه','توضیحات کامل','دسته‌بندی','فهرست اقلام مشاهده‌شده','وضعیت موجودی','محصول ویژه','قیمت','قیمت پس از تخفیف']:
        if not fields.get(key): errors.append(f'{book}: {key}')
    for key in ['تصویر اصلی پیشنهادی','تصویر اصلی ارسالی','تصویر معرفی']:
        f=book.parent/fields[key]
        if not f.is_file(): errors.append(str(f)); continue
        if f.suffix=='.svg': ET.parse(f)
        else:
            with Image.open(f) as im: im.verify()
print('workbooks:',n,'errors:',errors)
