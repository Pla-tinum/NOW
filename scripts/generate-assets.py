"""Generate reproducible NOW store and native launch artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'store' / 'artwork'
ART.mkdir(parents=True, exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def font(size):
    return ImageFont.truetype(FONT, size)

def backdrop(size):
    im = Image.new('RGB', (size, size))
    p = im.load()
    for y in range(size):
        for x in range(size):
            t = (x / size * .65 + y / size * .35)
            p[x, y] = (int(13 + 31*t), int(12 + 10*t), int(29 + 81*t))
    return im

def logo(size):
    im = backdrop(size)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((size*.09, size*.09, size*.91, size*.91), radius=size*.21,
                        outline=(158, 127, 255), width=max(1, int(size*.014)))
    f = font(int(size*.255))
    box = d.textbbox((0, 0), 'NOW', font=f)
    d.text(((size-(box[2]-box[0]))/2, size*.34-box[1]), 'NOW', font=f, fill='white')
    d.rounded_rectangle((size*.26, size*.69, size*.74, size*.715), radius=size*.013, fill=(153, 112, 255))
    return im

icon = logo(1024)
icon.save(ART / 'icon-1024.png')
icon.resize((512,512), Image.Resampling.LANCZOS).save(ART / 'google-play-icon-512.png')
icon.save(ROOT / 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

for density, px in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder = ROOT / f'android/app/src/main/res/mipmap-{density}'
    icon.resize((px,px),Image.Resampling.LANCZOS).save(folder / 'ic_launcher.png')
    icon.resize((px,px),Image.Resampling.LANCZOS).save(folder / 'ic_launcher_round.png')
    fg = Image.new('RGBA',(px,px),(0,0,0,0))
    mark = logo(round(px*.65)).convert('RGBA')
    fg.alpha_composite(mark,((px-mark.width)//2,(px-mark.height)//2))
    fg.save(folder / 'ic_launcher_foreground.png')

splash = Image.new('RGB',(2732,2732),(10,10,20))
mark = logo(900)
splash.paste(mark,((2732-900)//2,(2732-900)//2))
for file in (ROOT / 'ios/App/App/Assets.xcassets/Splash.imageset').glob('*.png'):
    splash.save(file)
for file in (ROOT / 'android/app/src/main/res').glob('drawable*/splash.png'):
    width,height=Image.open(file).size
    splash.resize((width,height),Image.Resampling.LANCZOS).save(file)

feature = Image.new('RGB',(1024,500),(15,13,33))
d = ImageDraw.Draw(feature)
mark = logo(380)
feature.paste(mark,(55,60))
d.text((490,150),'NOW',font=font(94),fill='white')
d.text((495,280),'Find what matters nearby',font=font(27),fill=(190,177,238))
feature.save(ART / 'google-play-feature-1024x500.png')
print('NOW native and store artwork generated')
