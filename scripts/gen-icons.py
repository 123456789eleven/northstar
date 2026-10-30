"""Regenerates public/icon-192.png, icon-512.png, icon-maskable-512.png from the geometry of public/icon.svg (needs Pillow)."""
from PIL import Image, ImageDraw
BG=(12,13,16,255); AC=(227,178,97,255); LINE=(int(12+(227-12)*.4),int(13+(178-13)*.4),int(16+(97-16)*.4),255)
def render(size, maskable):
    S=size*4; im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if maskable: d.rectangle([0,0,S,S],fill=BG); k=S/64*0.62; o=S*0.19
    else: d.rounded_rectangle([0,0,S-1,S-1],radius=S*14/64,fill=BG); k=S/64; o=0
    P=lambda x,y:(o+x*k,o+y*k)
    if maskable: k2=k; 
    d.line([P(14,32),P(50,32)],fill=LINE,width=max(1,int(2*k)))
    d.polygon([P(32,10),P(37,32),P(32,54),P(27,32)],fill=AC)
    return im.resize((size,size),Image.LANCZOS)
render(192,False).save('public/icon-192.png'); render(512,False).save('public/icon-512.png'); render(512,True).save('public/icon-maskable-512.png')
