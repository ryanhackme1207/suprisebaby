f = r'c:\Users\Acer Nitro 5\Desktop\suprise\surprise.html'
c = open(f, encoding='utf-8').read()

# Replace the whole downloadTicket function
start = c.find('        // ---- Download as PDF ----')
end = c.find('\n        }', start) + len('\n        }')
new_fn = """        // ---- Download - direct link, no canvas needed ----
        function downloadTicket() {
            const a = document.createElement('a');
            a.href = 'media/supprise i/1.png';
            a.download = '1.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }"""

c = c[:start] + new_fn + c[end:]
open(f, 'w', encoding='utf-8').write(c)
print('Done')
