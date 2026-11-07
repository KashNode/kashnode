#!/usr/bin/env python3
from pathlib import Path
from zipfile import ZIP_DEFLATED,ZipFile
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'android'/'kashnode-app';OUT=ROOT/'kashnode-android.zip';SKIP={'.gradle','.idea','build','.cxx','.git'}
def main():
 if not SRC.is_dir():raise SystemExit(f'Missing Android project: {SRC}')
 files=sorted(p for p in SRC.rglob('*') if p.is_file() and not SKIP.intersection(p.parts) and p.name not in {'local.properties','keystore.properties'})
 if not files:raise SystemExit('Refusing to create empty archive.')
 with ZipFile(OUT,'w',ZIP_DEFLATED,compresslevel=9) as z:
  for p in files:z.write(p,p.relative_to(ROOT))
 print(f'Created {OUT} ({len(files)} files)')
if __name__=='__main__':main()
