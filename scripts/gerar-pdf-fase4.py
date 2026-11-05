"""Generate the delivery PDF; missing team/video metadata produces an explicit draft."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "tmp" / "pdf-runtime"))
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable

DATA = json.loads((ROOT / "docs/fase4/entrega.json").read_text(encoding="utf-8"))
OUT = ROOT / "output/pdf/tech-challenge-fase4.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
NAVY, BLUE, MUTED = colors.HexColor("#17324D"), colors.HexColor("#1D4ED8"), colors.HexColor("#526170")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Cover", fontName="Helvetica-Bold", fontSize=27, leading=32, textColor=NAVY, spaceAfter=18))
styles.add(ParagraphStyle(name="Subtitle4", fontSize=13, leading=19, textColor=MUTED, spaceAfter=16))
styles["Heading1"].textColor=NAVY
styles["Heading2"].textColor=NAVY
styles["BodyText"].leading=15
styles["BodyText"].spaceAfter=9
story=[]
def p(text, style="BodyText"):
    return Paragraph(text,styles[style])
def table(rows, widths):
    obj=Table([[p(str(cell)) for cell in row] for row in rows],colWidths=widths,hAlign="LEFT")
    obj.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#EAF0F5")),("VALIGN",(0,0),(-1,-1),"TOP"),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#C5D0DC")),("LEFTPADDING",(0,0),(-1,-1),9),("RIGHTPADDING",(0,0),(-1,-1),9),("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),5)]))
    return obj

class Architecture(Flowable):
    def __init__(self):
        super().__init__();self.width=480;self.height=340
    def draw(self):
        c=self.canv
        def box(x,y,w,h,title,sub="",fill="#EAF0F5"):
            c.setFillColor(colors.HexColor(fill));c.setStrokeColor(NAVY);c.roundRect(x,y,w,h,6,fill=1)
            c.setFillColor(NAVY);c.setFont("Helvetica-Bold",10);c.drawCentredString(x+w/2,y+h-18,title)
            if sub:c.setFont("Helvetica",8);c.drawCentredString(x+w/2,y+10,sub)
        def line(x1,y1,x2,y2):
            c.setStrokeColor(BLUE);c.setLineWidth(1);c.line(x1,y1,x2,y2)
        box(170,289,140,42,"Portal + Auth Lambda","API Gateway HTTPS")
        line(240,289,240,272);line(70,272,410,272)
        for x,title,sub in [(0,"OS Service","Saga e atendimento"),(170,"Billing Service","Orçamento e pagamento"),(340,"Production Service","Diagnóstico e execução")]:
            box(x,205,140,52,title,sub);line(x+70,272,x+70,257)
        for x,title in [(0,"PostgreSQL OS"),(170,"PostgreSQL Billing"),(340,"DynamoDB Production")]:
            box(x,144,140,36,title,fill="#FFFFFF");line(x+70,205,x+70,180)
        box(120,74,240,38,"Mensageria SQS / DLQ","Comandos, eventos, correlação")
        line(140,230,150,230);line(150,230,150,112)
        line(310,230,325,230);line(325,230,325,112)
        line(340,220,332,220);line(332,220,332,112)
        box(370,18,110,38,"Mercado Pago","Checkout / webhook",fill="#FEF3C7")
        line(310,245,320,245);line(320,245,320,128);line(320,128,425,128);line(425,128,425,56)
        c.setFillColor(MUTED);c.setFont("Helvetica",8)
        c.drawString(0,0,"EKS compartilhado | Bancos exclusivos | Datadog: traces, logs e métricas")

draft=not DATA.get("participantes") or not DATA.get("video_url") or any(not person.get("identificacao") for person in DATA.get("participantes", []))
story.extend([Spacer(1,20),p("Oficina<br/>Tech Challenge - Fase 4","Cover"),p("Microsserviços, Saga Pattern e entrega automatizada","Subtitle4")])
if draft:story.append(p("<b>RASCUNHO DE ENTREGA</b> - identificação dos participantes e/ou vídeo ainda pendentes."))
story.extend([p("Participantes","Heading2")])
if DATA.get("participantes"):
    for person in DATA["participantes"]:story.append(p(f"{person['nome']} - {person.get('identificacao') or 'RM pendente'}"))
else:story.append(p("Identificação dos participantes: pendente de preenchimento pelo grupo."))
story.append(p("Repositórios","Heading2"))
for url in DATA["repositorios"]:
    story.append(p(f'<link href="{url}" color="#1D4ED8">{url}</link>'))
story.append(p("Vídeo de demonstração","Heading2"))
video=DATA.get("video_url")
story.append(p(f'<link href="{video}" color="#1D4ED8">{video}</link>' if video else "Pendente de gravação/publicação. Limite: 15 minutos."))
story.extend([PageBreak(),p("Arquitetura final","Heading1"),p("Três serviços independentes compartilham o cluster EKS e a observabilidade, mantendo propriedade exclusiva dos dados e infraestrutura de aplicação em seus próprios repositórios."),Architecture(),Spacer(1,18),table([["Serviço","Dados e responsabilidade"],["OS / PostgreSQL","Clientes, veículos, usuários, catálogo, OS, histórico e orquestrador persistente."],["Billing / PostgreSQL","Orçamentos, versões aprovadas, cobrança e confirmação Mercado Pago."],["Production / DynamoDB","Filas, diagnóstico, peças, reservas, consumo e conclusão técnica."]],[110,370])])
story.extend([PageBreak(),p("Saga e justificativas","Heading1"),p("A orquestração reside no OS Service. A decisão centralizada torna as etapas, os prazos técnicos e as compensações visíveis, preservando esperas humanas por aprovação e pagamento."),table([["Etapa","Avanço / compensação"],["Preparação","Congelar orçamento aprovado, reservar peças, confirmar e liberar execução."],["Falha antes do reparo","Cancelar reserva/trabalho e liberar orçamento; manter aprovação e histórico. Nova tentativa recebe outro sagaId."],["Após o reparo","Cobrar e aguardar confirmação. Recusa não desfaz reparo; entrega permanece bloqueada."],["Pagamento","Validar webhook e consultar recurso no Mercado Pago. Conferir valor, moeda e referência antes de liberar entrega."]],[110,370]),Spacer(1,14),p("Tecnologias e consistência","Heading2"),p("NestJS/TypeScript reduz o esforço de extração da base existente. PostgreSQL atende atendimento e transações financeiras; DynamoDB atende os agregados de produção. SQS desacopla o fluxo com retentativas e DLQ. Outbox/inbox e transações locais evitam perda de intents e duplicação de efeitos."),p("Qualidade e demonstração","Heading2"),p("Os repositórios incluem testes unitários com gate mínimo de 80%, BDD com os três serviços, teste do portal, Docker, Helm e Terraform. O CI executa testes e Sonar antes do deploy. Os READMEs devem apontar para as execuções reais de CI, cobertura e observabilidade."),p("Conferências externas antes do envio","Heading2"),p("Preencher acessos AWS, Sonar, Datadog e Mercado Pago; executar os deploys e o pagamento com contas de teste; registrar os links/evidências; preencher participantes e vídeo no arquivo entrega.json e regenerar este documento.")])

def footer(c,doc):
    c.setStrokeColor(colors.HexColor("#C5D0DC"));c.line(42,37,553,37)
    c.setFillColor(MUTED);c.setFont("Helvetica",8);c.drawString(42,25,"Oficina - Fase 4"+(" | Rascunho" if draft else ""));c.drawRightString(553,25,str(doc.page))
SimpleDocTemplate(str(OUT),pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=46,bottomMargin=52,title="Oficina - Tech Challenge Fase 4",author="Grupo Tech Challenge").build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
