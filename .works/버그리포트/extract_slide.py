# 버그리포트 특정 슬라이드 1장만 뽑기 (텍스트 + 이미지). 특정 BR 조사할 때만 사용.
# 전 슬라이드를 미리 뽑아두지 말 것(용량·토큰 낭비) — 필요한 슬라이드 번호만 그때그때.
#
# 사용:  python extract_slide.py <슬라이드번호>
# 예:    BR7~9 는 8p 이므로  ->  python extract_slide.py 8
#        이미지는 OS 임시폴더에 저장되고, 출력된 경로를 Read 로 열면 됨.
import sys, zipfile, re, os, tempfile
from xml.etree import ElementTree as ET

PPT = r"G:\내 드라이브\develop\u4a_ws4.0\issue\U4A WS4.0 이슈사항.pptx"

if len(sys.argv) < 2:
    print("사용: python extract_slide.py <슬라이드번호>"); sys.exit(1)
n = int(sys.argv[1])
z = zipfile.ZipFile(PPT)
ns = '{http://schemas.openxmlformats.org/drawingml/2006/main}'

sl = 'ppt/slides/slide%d.xml' % n
if sl not in z.namelist():
    print("슬라이드 %d 없음" % n); sys.exit(1)

root = ET.fromstring(z.read(sl))
print("=== Slide %d 텍스트 ===" % n)
for t in root.iter(ns + 't'):
    if t.text and t.text.strip():
        print(t.text)

rels = 'ppt/slides/_rels/slide%d.xml.rels' % n
imgs = re.findall(r'Target="\.\./media/([^"]+)"', z.read(rels).decode('utf-8', 'ignore')) if rels in z.namelist() else []
out = tempfile.gettempdir()
print("\n=== 이미지 파일 (아래 경로를 Read 로 열기) ===")
found = False
for i, m in enumerate(imgs):
    if not re.search(r'\.(png|jpg|jpeg|gif)$', m, re.I):
        continue
    p = 'ppt/media/' + m
    if p in z.namelist():
        fp = os.path.join(out, 'br_slide%d_%d%s' % (n, i + 1, os.path.splitext(m)[1].lower()))
        open(fp, 'wb').write(z.read(p))
        print(fp); found = True
if not found:
    print("(이미지 없음)")
