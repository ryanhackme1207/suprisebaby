import os, json
folder = r'c:\Users\Acer Nitro 5\Desktop\suprise\media\老婆'
exts = ('.jpg', '.jpeg', '.png', '.webp')
files = sorted([f for f in os.listdir(folder) if f.lower().endswith(exts)])
out = r'c:\Users\Acer Nitro 5\Desktop\suprise\media\photos.js'
with open(out, 'w', encoding='utf-8') as fp:
    fp.write('window.ALL_PHOTOS_DATA = ')
    json.dump(files, fp, ensure_ascii=False, indent=2)
    fp.write(';\n')
print(f'Done: {len(files)} photos saved to photos.js')
