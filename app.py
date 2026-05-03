from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import sqlite3
import os
import hashlib
import json
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'super_secret_key_change_in_production'
CORS(app)

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://fonts.gstatic.com;"
    return response

DB_PATH = 'figuritas.db'
ADMIN_EMAIL = 'facusanlucas@gmail.com'

# ── Stickers list for World Cup 2026 ─────────────────────────────────────────
STICKERS = []

def build_stickers_list():
    global STICKERS
    STICKERS = []
    # FWC stickers (special + intro pages)
    for i in range(1, 21):
        STICKERS.append({'id': f'FWC{str(i).zfill(2)}', 'nombre': f'FIFA World Cup#{i} Intro', 'seccion': 'FIFA World Cup'})
    
    for group, teams in GROUPS.items():
        for team in teams:
            code = TEAM_CODES.get(team, team[:3].upper())
            for i in range(1, 21):  # 20 stickers: 1 to 20
                player_name = get_player_name(team, i)
                num_str = str(i).zfill(2)
                STICKERS.append({
                    'id': f'{code}{num_str}',
                    'nombre': f'{team}#{i} {player_name}'.strip(),
                    'seccion': f'Grupo {group} - {team}'
                })

# Call build_stickers_list after all dicts are defined (GROUPS, TEAM_CODES, REAL_PLAYERS)
# I'll move the call to the end of the global scope in the next chunk.

# Countries (12 groups × 4 teams = 48 teams for 2026)
GROUPS = {
    "A": [
        "Argentina",
        "Francia",
        "Estados Unidos",
        "Sudáfrica"
    ],
    "B": [
        "Brasil",
        "Alemania",
        "Curazao",
        "Túnez"
    ],
    "C": [
        "Colombia",
        "Países Bajos",
        "Haití",
        "Australia"
    ],
    "D": [
        "Ecuador",
        "Noruega",
        "Panamá",
        "Irak"
    ],
    "E": [
        "Paraguay",
        "Portugal",
        "Argelia",
        "Irán"
    ],
    "F": [
        "Uruguay",
        "Escocia",
        "Cabo Verde",
        "Japón"
    ],
    "G": [
        "Austria",
        "España",
        "RD Congo",
        "Jordania"
    ],
    "H": [
        "Bélgica",
        "Suecia",
        "Costa de Marfil",
        "Corea del Sur"
    ],
    "I": [
        "Bosnia y Herzegovina",
        "Suiza",
        "Egipto",
        "Qatar"
    ],
    "J": [
        "Croacia",
        "Turquía",
        "Ghana",
        "Arabia Saudita"
    ],
    "K": [
        "Chequia",
        "Canadá",
        "Marruecos",
        "Uzbekistán"
    ],
    "L": [
        "Inglaterra",
        "México",
        "Senegal",
        "Nueva Zelanda"
    ]
}

TEAM_CODES = {
    "Argentina": "ARG",
    "Brasil": "BRA",
    "Colombia": "COL",
    "Ecuador": "ECU",
    "Paraguay": "PAR",
    "Uruguay": "URU",
    "Austria": "AUT",
    "Bélgica": "BEL",
    "Bosnia y Herzegovina": "BIH",
    "Croacia": "CRO",
    "Chequia": "CZE",
    "Inglaterra": "ENG",
    "Francia": "FRA",
    "Alemania": "GER",
    "Países Bajos": "NED",
    "Noruega": "NOR",
    "Portugal": "POR",
    "Escocia": "SCO",
    "España": "ESP",
    "Suecia": "SWE",
    "Suiza": "SUI",
    "Turquía": "TUR",
    "Canadá": "CAN",
    "México": "MEX",
    "Estados Unidos": "USA",
    "Curazao": "CUW",
    "Haití": "HAI",
    "Panamá": "PAN",
    "Argelia": "ALG",
    "Cabo Verde": "CPV",
    "RD Congo": "COD",
    "Costa de Marfil": "CIV",
    "Egipto": "EGY",
    "Ghana": "GHA",
    "Marruecos": "MAR",
    "Senegal": "SEN",
    "Sudáfrica": "RSA",
    "Túnez": "TUN",
    "Australia": "AUS",
    "Irak": "IRQ",
    "Irán": "IRN",
    "Japón": "JPN",
    "Jordania": "JOR",
    "Corea del Sur": "KOR",
    "Qatar": "QAT",
    "Arabia Saudita": "KSA",
    "Uzbekistán": "UZB",
    "Nueva Zelanda": "NZL"
}

REAL_PLAYERS = {
    'Argentina': ['', 'Escudo AFA', 'E. Martínez', 'F. Armani', 'N. Molina', 'C. Romero', 'N. Otamendi', 'L. Martínez Quarta', 'N. Tagliafico', 'R. De Paul', 'E. Fernández', 'A. Mac Allister', 'G. Lo Celso', 'Foto de Equipo', 'L. Paredes', 'L. Messi', 'J. Álvarez', 'L. Martínez', 'A. Garnacho', 'N. González', 'P. Dybala'],
    'Brasil': ['', 'Escudo CBF', 'Alisson', 'Ederson', 'Danilo', 'Marquinhos', 'Gabriel Magalhães', 'Éder Militão', 'Guilherme Arana', 'Bruno Guimarães', 'Lucas Paquetá', 'Douglas Luiz', 'Casemiro', 'Foto de Equipo', 'Vinícius Júnior', 'Rodrygo', 'Raphinha', 'Gabriel Martinelli', 'Richarlison', 'Endrick', 'Savinho'],
    'Colombia': ["", "Escudo FCF", "C. Vargas", "D. Ospina", "D. Sánchez", "C. Cuesta", "Y. Mina", "D. Muñoz", "J. Mojica", "J. Lerma", "R. Ríos", "M. Uribe", "K. Castaño", "Foto de Equipo", "J. Arias", "J. Rodríguez", "L. Díaz", "R. Borré", "J. Córdoba", "L. Sinisterra", "J. Quintero"],
    'Ecuador': ["", "Escudo FEF", "A. Domínguez", "H. Galíndez", "P. Hincapié", "F. Torres", "W. Pacho", "A. Preciado", "P. Estupiñán", "M. Caicedo", "C. Gruezo", "A. Franco", "K. Páez", "Foto de Equipo", "J. Cifuentes", "J. Sarmiento", "E. Valencia", "K. Rodríguez", "J. Yeboah", "A. Mena", "C. Ortiz"],
    'Paraguay': ["", "Escudo APF", "C. Coronel", "R. Fernández", "G. Gómez", "F. Balbuena", "O. Alderete", "J. Alonso", "M. Espinoza", "M. Villasanti", "A. Cubas", "D. Gómez", "R. Rojas", "Foto de Equipo", "M. Almirón", "J. Enciso", "R. Sosa", "A. Sanabria", "A. Bareiro", "D. González", "H. Martínez"],
    'Uruguay': ['', 'Escudo AUF', 'S. Rochet', 'F. Muslera', 'R. Araujo', 'J. Giménez', 'M. Olivera', 'M. Viña', 'N. Nández', 'F. Valverde', 'R. Bentancur', 'N. De la Cruz', 'M. Ugarte', 'Foto de Equipo', 'G. De Arrascaeta', 'D. Núñez', 'L. Suárez', 'F. Pellistri', 'M. Araújo', 'B. Rodríguez', 'C. Olivera'],
    'Austria': ["", "Escudo Austria", "P. Pentz", "M. Hedl", "D. Alaba", "K. Danso", "P. Lienhart", "S. Posch", "M. Wöber", "K. Laimer", "C. Baumgartner", "M. Sabitzer", "F. Grillitsch", "Foto de Equipo", "M. Gregoritsch", "P. Wimmer", "M. Arnautović", "S. Weimann", "A. Adamu", "P. Lainer", "R. Querfeld"],
    'Bélgica': ["", "Escudo RBFA", "K. Casteels", "T. Kaminski", "J. Vertonghen", "W. Faes", "Z. Debast", "T. Castagne", "A. Theate", "A. Onana", "Y. Tielemans", "K. De Bruyne", "O. Mangala", "Foto de Equipo", "A. Vranckx", "J. Doku", "R. Lukaku", "L. Trossard", "J. Bakayoko", "D. Lukebakio", "C. De Ketelaere"],
    'Bosnia y Herzegovina': ["", "Escudo Bosnia y Herzegovina", "I. Pirić", "A. Šehić", "S. Kolasinac", "H. Hajradinović", "A. Belamić", "N. Milenkovic", "D. Zlatan", "M. Pjanić", "E. Džeko", "S. Kovačević", "R. Gigović", "Foto de Equipo", "L. Ahmedhodzić", "S. Šunjić", "E. Tahirović", "D. Husić", "A. Dupovac", "S. Prevljak", "N. Drkusić"],
    'Croacia': ["", "Escudo HNS", "D. Livaković", "I. Ivušić", "J. Gvardiol", "J. Šutalo", "M. Erlić", "J. Juranović", "B. Sosa", "L. Modrić", "M. Kovačić", "M. Brozović", "M. Pašalić", "Foto de Equipo", "L. Majer", "L. Sučić", "A. Kramarić", "B. Petković", "I. Perišić", "M. Pjaca", "A. Budimir"],
    'Chequia': ["", "Escudo Chequia", "J. Staněk", "M. Kovář", "T. Souček", "L. Červiček", "D. Jurásek", "O. Čelůstka", "T. Vlček", "A. Barák", "P. Šulc", "L. Sadílek", "M. Fila", "Foto de Equipo", "A. Hlozek", "V. Jurečka", "M. Kuchta", "J. Chytil", "P. Ševčík", "O. Lingr", "P. Vydra"],
    'Inglaterra': ['', 'Escudo FA', 'J. Pickford', 'A. Ramsdale', 'K. Walker', 'John Stones', 'H. Maguire', 'L. Shaw', 'K. Trippier', 'D. Rice', 'J. Bellingham', 'P. Foden', 'B. Saka', 'Foto de Equipo', 'J. Grealish', 'T. Alexander-Arnold', 'H. Kane', 'O. Watkins', 'M. Rashford', 'C. Palmer', 'A. Gordon'],
    'Francia': ['', 'Escudo FFF', 'M. Maignan', 'A. Areola', 'T. Hernández', 'D. Upamecano', 'I. Konaté', 'W. Saliba', 'J. Koundé', 'A. Tchouaméni', 'E. Camavinga', 'A. Rabiot', 'W. Zaïre-Emery', 'Foto de Equipo', 'K. Mbappé', 'A. Griezmann', 'O. Dembélé', 'M. Thuram', 'K. Coman', 'R. Kolo Muani', 'B. Barcola'],
    'Alemania': ["", "Escudo DFB", "M. Neuer", "M. ter Stegen", "A. Rüdiger", "N. Schlotterbeck", "J. Tah", "D. Raum", "J. Kimmich", "I. Gündoğan", "T. Kroos", "J. Musiala", "F. Wirtz", "Foto de Equipo", "L. Sané", "K. Havertz", "N. Füllkrug", "S. Gnabry", "T. Müller", "R. Andrich", "B. Henrichs"],
    'Países Bajos': ["", "Escudo KNVB", "B. Verbruggen", "M. Flekken", "V. van Dijk", "N. Aké", "S. de Vrij", "M. de Ligt", "D. Dumfries", "F. de Jong", "T. Reijnders", "J. Schouten", "X. Simons", "Foto de Equipo", "C. Gakpo", "M. Depay", "W. Weghorst", "D. Malen", "S. Bergwijn", "J. Veerman", "L. Geertruida"],
    'Noruega': ["", "Escudo Noruega", "Ø. Nyland", "J. Hitz", "K. Ajer", "L. Sørensen", "B. Meling", "S. Strandberg", "J. Ryerson", "M. Ødegaard", "S. Berge", "P.A. Aas", "F. Aursnes", "Foto de Equipo", "A. Sørloth", "E. Haaland", "O.J. Hasund", "A. Thorstvedt", "J. Odegård", "R. Hauge", "N. Aamodt Nusa"],
    'Portugal': ["", "Escudo FPF", "D. Costa", "R. Patrício", "R. Dias", "Pepe", "G. Inácio", "J. Cancelo", "N. Mendes", "D. Dalot", "B. Fernandes", "Vitinha", "J. Palhinha", "Foto de Equipo", "R. Neves", "B. Silva", "R. Leão", "C. Ronaldo", "J. Félix", "D. Jota", "G. Ramos"],
    'Escocia': ["", "Escudo Escocia", "A. Gunn", "C. Gordon", "A. Robertson", "G. Hanley", "J. Hendry", "N. Patterson", "R. McKenna", "C. McGregor", "S. McTominay", "B. Gilmour", "J. McGinn", "Foto de Equipo", "L. Ferguson", "R. Christie", "C. Adams", "K. Nisbet", "S. Armstrong", "J. Shankland", "R. Jack"],
    'España': ['', 'Escudo RFEF', 'U. Simón', 'D. Raya', 'D. Carvajal', 'R. Le Normand', 'A. Laporte', 'P. Torres', 'A. Grimaldo', 'Rodri', 'Pedri', 'Gavi', 'F. Ruiz', 'Foto de Equipo', 'L. Yamal', 'A. Morata', 'N. Williams', 'D. Olmo', 'M. Oyarzabal', 'F. Torres', 'Joselu'],
    'Suecia': ["", "Escudo SvFF", "R. Olsen", "V. Johansson", "V. Lindelöf", "I. Hien", "C. Starfelt", "E. Krafth", "L. Augustinsson", "H. Ekdal", "M. Svanberg", "J. Cajuste", "S. Gustafson", "Foto de Equipo", "E. Forsberg", "D. Kulusevski", "A. Elanga", "J. Karlsson", "A. Isak", "V. Gyökeres", "R. Quaison"],
    'Suiza': ["", "Escudo Suiza", "Y. Sommer", "P. Mvogo", "M. Akanji", "F. Schär", "S. Widmer", "R. Rodríguez", "E. Steffen", "G. Xhaka", "R. Freuler", "D. Zakaria", "V. Vargas", "Foto de Equipo", "X. Shaqiri", "H. Seferovic", "B. Embolo", "N. Okafor", "D. Ndoye", "Z. Amdouni", "S. Duah"],
    'Turquía': ["", "Escudo TFF", "U. Çakır", "M. Günok", "C. Söyüncü", "M. Demiral", "O. Kabak", "F. Kadıoğlu", "Z. Çelik", "H. Çalhanoğlu", "S. Özcan", "I. Yüksek", "O. Kökçü", "Foto de Equipo", "A. Güler", "K. Aktürkoğlu", "I. Kahveci", "B. Yılmaz", "K. Yıldız", "C. Tosun", "E. Ünal"],
    'Canadá': ["", "Escudo CSA", "M. Crépeau", "D. St. Clair", "A. Davies", "A. Johnston", "D. Cornelius", "K. Miller", "M. Bombito", "S. Eustáquio", "I. Koné", "J. Osorio", "S. Piette", "Foto de Equipo", "T. Buchanan", "L. Millar", "J. David", "C. Larin", "T. Bair", "J. Shaffelburg", "A. Ahmed"],
    'México': ['', 'Escudo FMF', 'G. Ochoa', 'L. Malagón', 'J. Sánchez', 'C. Montes', 'J. Vásquez', 'J. Gallardo', 'E. Álvarez', 'L. Romo', 'L. Chávez', 'O. Pineda', 'E. Sánchez', 'Foto de Equipo', 'H. Lozano', 'U. Antuna', 'S. Giménez', 'H. Martín', 'R. Jiménez', 'J. Quiñones', 'C. Huerta'],
    'Estados Unidos': ['', 'Escudo US Soccer', 'M. Turner', 'E. Horvath', 'S. Dest', 'C. Richards', 'T. Ream', 'A. Robinson', 'W. McKennie', 'Y. Musah', 'T. Adams', 'G. Reyna', 'C. Pulisic', 'Foto de Equipo', 'T. Weah', 'F. Balogun', 'R. Pepi', 'J. Sargent', 'B. Aaronson', 'M. Tillman', 'J. Scally'],
    'Curazao': ["", "Escudo Curazao", "E. Ramirez", "D. Zwalua", "J. Hooi", "C. Kwidama", "K. Pinas", "G. Marchena", "E. Kuwas", "G. Suk", "L. Fer", "S. Martha", "J. Klok", "Foto de Equipo", "J. Bonevacia", "F. Bakkali", "E. Flemming", "R. Sadó", "C. Bermúdez", "S. Adó", "S. Wilnis"],
    'Haití': ["", "Escudo Haití", "J.R. Guzón", "C. Labrosse", "C. Noel", "O. Gerenoc", "O. Pierre", "E. Zéphirin", "J. Pierre", "D. Étienne", "S. Dumé", "K. Bien-Aimé", "R. Metayer", "Foto de Equipo", "J. Metayer", "R. Borgella", "K. Jean", "N. Geffrard", "F. Cantave", "K. Antoine", "A. Germain"],
    'Panamá': ["", "Escudo FEPAFUT", "O. Mosquera", "L. Mejía", "A. Andrade", "F. Escobar", "J. Córdoba", "M. Murillo", "E. Davis", "A. Carrasquilla", "C. Martínez", "A. Godoy", "J. Welch", "Foto de Equipo", "E. Bárcenas", "I. Díaz", "J. Rodríguez", "J. Fajardo", "C. Waterman", "E. Guerrero", "I. Anderson"],
    'Argelia': ["", "Escudo FAF", "A. Mandrea", "R. Mbolhi", "R. Bensebaini", "A. Mandi", "R. Aït-Nouri", "Y. Atal", "M. Tougai", "I. Bennacer", "N. Bentaleb", "H. Aouar", "R. Zerrouki", "Foto de Equipo", "F. Chaïbi", "R. Mahrez", "Y. Belaïli", "A. Ounas", "I. Slimani", "B. Bounedjah", "M. Amoura"],
    'Cabo Verde': ["", "Escudo Cabo Verde", "Z. Varela", "M. Tavares", "J. Ramos", "A. Borges", "R. Fernandes", "D. Almeida", "C. Costa", "E. Andrade", "P. Medina", "J. Lopes", "G. Benchimol", "Foto de Equipo", "D. Tavares", "E. Tavares", "E. Benchimol", "R. Silva", "H. Santos", "N. Varela", "R. Gomes"],
    'RD Congo': ["", "Escudo RD Congo", "O. Kiassumbua", "J. Mpasi", "G. Ngadeu-Ngadjui", "B. Batubinsika", "D. Lebo Lebo", "P. Bongonda", "A. Mbemba", "Y. Bolasie", "C. Makiese", "W. Bope Lobota", "O. Tshikeba", "Foto de Equipo", "M. Tisserand", "S. Kakuta", "H. Kafumbe", "D. Kamara", "C. Masuaku", "A. Diata", "C. Luyindama"],
    'Costa de Marfil': ["", "Escudo FIF", "Y. Fofana", "C. Folly", "E. Ndicka", "O. Kossounou", "W. Boly", "S. Aurier", "G. Konan", "F. Kessié", "S. Fofana", "I. Sangaré", "J. Seri", "Foto de Equipo", "S. Adingra", "J. Boga", "N. Pépé", "M. Gradel", "S. Haller", "C. Kouamé", "O. Diakité"],
    'Egipto': ["", "Escudo EFA", "M. El Shenawy", "G. Gabaski", "A. Hegazi", "M. Abdelmonem", "A. Gabr", "M. Hany", "A. Fotouh", "M. Elneny", "M. Attia", "E. Ashour", "Zizo", "Foto de Equipo", "M. Salah", "M. Trezeguet", "O. Marmoush", "M. Fathi", "M. Mohamed", "Kahraba", "A. Rayan"],
    'Ghana': ["", "Escudo Ghana", "L. Ati-Zigi", "J. Mensah", "D. Amartey", "A. Djiku", "B. Mensah", "T. Lamptey", "R. Baba", "T. Partey", "M. Kudus", "B. Ayew", "S. Sulemana", "Foto de Equipo", "J. Ayew", "J. Paintsil", "O. Afena-Gyan", "A. Issahaku", "E. Caleb Ekuban", "I. Dawuni", "A. Semenyo"],
    'Marruecos': ["", "Escudo FRMF", "Y. Bounou", "M. Mohamedi", "R. Saïss", "N. Aguerd", "A. Hakimi", "N. Mazraoui", "Y. Attiyat Allah", "S. Amrabat", "A. Ounahi", "S. Amallah", "B. El Khannouss", "Foto de Equipo", "H. Ziyech", "S. Boufal", "A. Adli", "Y. En-Nesyri", "A. El Kaabi", "A. Ezzalzouli", "B. Diaz"],
    'Senegal': ["", "Escudo FSF", "E. Mendy", "S. Dieng", "K. Koulibaly", "A. Diallo", "M. Niakhaté", "Y. Sabaly", "F. Ballo-Touré", "I. Gueye", "P. Sarr", "N. Mendy", "L. Camara", "Foto de Equipo", "P. Ciss", "S. Mané", "I. Sarr", "H. Diallo", "N. Jackson", "I. Ndiaye", "B. Dia"],
    'Sudáfrica': ["", "Escudo Sudáfrica", "R. Williams", "B. Petersen", "T. Xulu", "S. Mvala", "S. Modiba", "N. Mobbie", "G. Mashele", "B. Zungu", "T. Maart", "K. Dolly", "E. Zwane", "Foto de Equipo", "T. Hlongwane", "L. Foster", "T. Lebogang", "P. Sekgota", "I. Safranko", "L. Brockie", "M. Jiyane"],
    'Túnez': ["", "Escudo FTF", "A. Dahmen", "B. Ben Said", "M. Talbi", "Y. Meriah", "A. Abdi", "W. Kechrida", "O. Haddadi", "E. Skhiri", "A. Laïdouni", "M. Ben Romdhane", "H. Mejbri", "Foto de Equipo", "N. Sliti", "Y. Msakni", "E. Achouri", "A. Ben Slimane", "S. Jaziri", "T. Khenissi", "H. Rafia"],
    'Australia': ["", "Escudo FA", "M. Ryan", "J. Gauci", "H. Souttar", "K. Rowles", "C. Burgess", "N. Atkinson", "A. Behich", "J. Irvine", "K. Baccus", "C. Metcalfe", "R. McGree", "Foto de Equipo", "A. Hrustic", "M. Boyle", "C. Goodwin", "S. Silvera", "M. Duke", "K. Yengi", "J. Maclaren"],
    'Irak': ["", "Escudo Irak", "J. Kassid", "M. Hameed", "M. Al-Mawas", "A. Hamza", "A. Mezher", "S. Mahdi", "A. Al-Hamdani", "A. Adnan", "K. Al-Rashid", "D. Al-Rubaie", "A. Fadhel", "Foto de Equipo", "A. Hassan", "M. Al-Tamari", "A. Al-Musawi", "O. Khribit", "Y. Jabbar", "N. Karim", "A. Al-Jubouri"],
    'Irán': ["", "Escudo FFIRI", "A. Beiranvand", "S. Niazmand", "S. Azmoun", "M. Taremi", "A. Jahanbakhsh", "S. Ghoddos", "S. Ezatolahi", "A. Gholizadeh", "R. Rezaeian", "E. Hajsafi", "M. Mohammadi", "Foto de Equipo", "H. Kanani", "S. Khalilzadeh", "M. Hosseini", "A. Noorafkan", "O. Noorafkan", "M. Mohebi", "M. Torabi"],
    'Japón': ["", "Escudo JFA", "Z. Suzuki", "D. Maekawa", "T. Tomiyasu", "K. Itakura", "H. Ito", "Y. Sugawara", "S. Taniguchi", "W. Endo", "H. Morita", "R. Hatate", "T. Minamino", "Foto de Equipo", "D. Kamada", "T. Kubo", "J. Ito", "K. Mitoma", "R. Doan", "A. Ueda", "T. Asano"],
    'Jordania': ["", "Escudo Jordania", "M. Shtiwi", "Y. Abu Layla", "Y. Nasib", "E. Bani Yaseen", "O. Al-Douri", "B. Dabbas", "A. Al-Tamari", "M. Suleiman", "B. Alskafi", "M. Abu Zema", "H. Musa", "Foto de Equipo", "O. Hani", "M. Musa", "A. Dardour", "H. Bani Attiyeh", "A. Khader", "Z. Al-Rawabdeh", "H. Shelbaieh"],
    'Corea del Sur': ["", "Escudo KFA", "J. Hyeon-woo", "S. Bum-keun", "K. Min-jae", "J. Seung-hyun", "K. Young-gwon", "S. Young-woo", "K. Jin-su", "H. In-beom", "P. Yong-woo", "L. Kang-in", "L. Jae-sung", "Foto de Equipo", "J. Woo-young", "S. Heung-min", "H. Hee-chan", "C. Gue-sung", "O. Hyeon-gyu", "J. Min-kyu", "Y. Sang-ho"],
    'Qatar': ["", "Escudo QFA", "M. Barsham", "S. Al Sheeb", "B. Al-Rawi", "T. Salman", "A. Mukhtar", "P. Miguel", "H. Al Amin", "A. Hatem", "M. Waad", "A. Assadalla", "A. Fatehi", "Foto de Equipo", "J. Gaber", "A. Afif", "H. Al-Haydos", "A. Ali", "Y. Abdurisag", "K. Muneer", "A. Alaaeldin"],
    'Arabia Saudita': ["", "Escudo SAFF", "M. Al-Owais", "N. Al-Aqidi", "A. Al-Bulaihi", "H. Tambakti", "A. Lajami", "S. Abdulhamid", "Y. Al-Shahrani", "M. Kanno", "A. Al-Malki", "N. Al-Dawsari", "S. Al-Najei", "Foto de Equipo", "S. Al-Dawsari", "A. Ghareeb", "F. Al-Muwallad", "S. Al-Shehri", "F. Al-Buraikan", "A. Radif", "M. Maran"],
    'Uzbekistán': ["", "Escudo Uzbekistán", "U. Nishonov", "A. Abdurakhimov", "S. Sayfiev", "O. Temur", "O. Komilov", "S. Ergashev", "D. Khamdamov", "J. Tursunov", "J. Hamidov", "A. Shomurodov", "S. Toshev", "Foto de Equipo", "I. Kobilov", "D. Suyunov", "U. Alijonov", "E. Shomurodov", "B. Nazarov", "A. Ismoilov", "R. Dadaev"],
    'Nueva Zelanda': ["", "Escudo NZF", "O. Sail", "M. Crocombe", "C. Cacace", "T. Smith", "M. Boxall", "T. Payne", "B. Tuiloma", "M. Stamenic", "J. Bell", "S. Singh", "M. Garbett", "Foto de Equipo", "C. Lewis", "B. Waine", "C. Wood", "K. Barbarouses", "A. Rufer", "E. Just", "M. Mata"],
}

def get_player_name(team, sticker_num):
    # sticker_num is 1 to 20; array index = sticker_num directly
    # [0]=ignored, [1]=Escudo, [2-12]=jugadores, [13]=Foto de Equipo, [14-20]=jugadores
    if team in REAL_PLAYERS:
        arr = REAL_PLAYERS[team]
        if sticker_num < len(arr):
            return arr[sticker_num]
        return ""
    if sticker_num == 1: return 'Escudo'
    if sticker_num == 13: return 'Foto de Equipo'
    return ""

build_stickers_list()

# ── Database setup ────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lote TEXT NOT NULL,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS stickers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sticker_id TEXT NOT NULL,
        estado TEXT NOT NULL CHECK(estado IN ('tengo', 'me_falta', 'repetida')),
        cantidad INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, sticker_id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER,
        room TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(from_user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        from_stickers TEXT NOT NULL,
        to_stickers TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'cancelled')),
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(from_user_id) REFERENCES users(id),
        FOREIGN KEY(to_user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS juntadas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        fecha TEXT NOT NULL,
        lugar TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS juntada_rsvp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        juntada_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'going',
        FOREIGN KEY(juntada_id) REFERENCES juntadas(id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(juntada_id, user_id)
    )''')

    conn.commit()
    conn.close()

def hash_password(password):
    return generate_password_hash(password)

def check_password(hashed, password):
    if hashed.startswith('pbkdf2:') or hashed.startswith('scrypt:'):
        return check_password_hash(hashed, password)
    return hashed == hashlib.sha256(password.encode()).hexdigest()

# ── Auth routes ───────────────────────────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    lote = data.get('lote', '').strip()
    nombre = data.get('nombre', '').strip()
    apellido = data.get('apellido', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([lote, nombre, apellido, email, password]):
        return jsonify({'success': False, 'error': 'Todos los campos son requeridos'})

    conn = get_db()
    try:
        conn.execute(
            'INSERT INTO users (lote, nombre, apellido, email, password_hash) VALUES (?, ?, ?, ?, ?)',
            (lote, nombre, apellido, email, hash_password(password))
        )
        conn.commit()
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        session['user_id'] = user['id']
        session['email'] = email
        session['nombre'] = nombre
        session['lote'] = lote
        return jsonify({'success': True})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'El email ya está registrado'})
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    
    if user and check_password(user['password_hash'], password):
        # Update hash if it was legacy
        if not user['password_hash'].startswith('pbkdf2:') and not user['password_hash'].startswith('scrypt:'):
            conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (hash_password(password), user['id']))
            conn.commit()
            
        session['user_id'] = user['id']
        session['email'] = email
        session['nombre'] = user['nombre']
        session['lote'] = user['lote']
        return jsonify({'success': True, 'is_admin': email == ADMIN_EMAIL})
    return jsonify({'success': False, 'error': 'Email o contraseña incorrectos'})

def hash_password(password):
    return generate_password_hash(password)

def check_password(hashed, password):
    if hashed.startswith('pbkdf2:') or hashed.startswith('scrypt:'):
        return check_password_hash(hashed, password)
    return hashed == hashlib.sha256(password.encode()).hexdigest()

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/api/account', methods=['DELETE'])
def delete_account():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    uid = session['user_id']
    conn = get_db()
    conn.execute('DELETE FROM stickers WHERE user_id = ?', (uid,))
    conn.execute('DELETE FROM juntada_rsvp WHERE user_id = ?', (uid,))
    conn.execute('DELETE FROM trades WHERE from_user_id = ? OR to_user_id = ?', (uid, uid))
    conn.execute('DELETE FROM messages WHERE from_user_id = ?', (uid,))
    conn.execute('DELETE FROM juntadas WHERE created_by = ?', (uid,))
    conn.execute('DELETE FROM users WHERE id = ?', (uid,))
    conn.commit()
    conn.close()
    session.clear()
    return jsonify({'success': True})

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html',
        nombre=session['nombre'],
        lote=session['lote'],
        is_admin=(session['email'] == ADMIN_EMAIL)
    )

# ── Stickers API ──────────────────────────────────────────────────────────────
@app.route('/api/stickers', methods=['GET'])
def get_all_stickers():
    # Force rebuild if someone hit this and it's old format (quick fix for cache)
    if not STICKERS or STICKERS[0]['id'].endswith('00'):
        build_stickers_list()
    return jsonify(STICKERS)

# Moved build_stickers_list up to line 228

@app.route('/api/mis-figuritas', methods=['GET'])
def get_my_stickers():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    rows = conn.execute(
        'SELECT sticker_id, estado, cantidad FROM stickers WHERE user_id = ?',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/mis-figuritas', methods=['POST'])
def update_sticker():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    data = request.json
    sticker_id = data.get('sticker_id')
    estado = data.get('estado')  # 'tengo', 'me_falta', 'repetida', or null to delete
    cantidad = data.get('cantidad', 1)

    conn = get_db()
    if estado is None:
        conn.execute(
            'DELETE FROM stickers WHERE user_id = ? AND sticker_id = ?',
            (session['user_id'], sticker_id)
        )
    else:
        conn.execute('''INSERT INTO stickers (user_id, sticker_id, estado, cantidad)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, sticker_id) DO UPDATE SET estado=excluded.estado, cantidad=excluded.cantidad''',
            (session['user_id'], sticker_id, estado, cantidad)
        )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/usuarios', methods=['GET'])
def get_users():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    users = conn.execute(
        'SELECT id, lote, nombre, apellido, email FROM users WHERE id != ?',
        (session['user_id'],)
    ).fetchall()
    result = []
    for u in users:
        stickers = conn.execute(
            'SELECT sticker_id, estado, cantidad FROM stickers WHERE user_id = ?',
            (u['id'],)
        ).fetchall()
        result.append({
            'id': u['id'],
            'lote': u['lote'],
            'nombre': u['nombre'],
            'apellido': u['apellido'],
            'email': u['email'],
            'stickers': [dict(s) for s in stickers]
        })
    conn.close()
    return jsonify(result)

@app.route('/api/usuario/<int:user_id>/figuritas', methods=['GET'])
def get_user_stickers(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    user = conn.execute('SELECT id, lote, nombre, apellido FROM users WHERE id = ?', (user_id,)).fetchone()
    stickers = conn.execute(
        'SELECT sticker_id, estado, cantidad FROM stickers WHERE user_id = ?', (user_id,)
    ).fetchall()
    conn.close()
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    return jsonify({'user': dict(user), 'stickers': [dict(s) for s in stickers]})

# ── Messages API ──────────────────────────────────────────────────────────────
@app.route('/api/my_pms', methods=['GET'])
def get_my_pms():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    uid = str(session['user_id'])
    rooms = conn.execute('''
        SELECT DISTINCT room 
        FROM messages 
        WHERE room LIKE 'pm_%' AND (
            room LIKE ? OR room LIKE ? OR room = ?
        )
    ''', (f'pm_{uid}_%', f'pm_%_{uid}', f'pm_{uid}_{uid}')).fetchall()
    
    result = []
    for r in rooms:
        room = r['room']
        parts = room.split('_')
        if len(parts) == 3:
            other_id = parts[1] if parts[2] == str(uid) else parts[2]
            other_user = conn.execute('SELECT id, nombre, apellido FROM users WHERE id = ?', (other_id,)).fetchone()
            if other_user:
                result.append({'room': room, 'user': dict(other_user)})
    conn.close()
    return jsonify(result)

@app.route('/api/messages/<room>', methods=['GET'])
def get_messages(room):
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    msgs = conn.execute('''
        SELECT m.id, m.content, m.created_at, m.room,
               u.nombre, u.apellido, u.lote, u.id as user_id
        FROM messages m
        JOIN users u ON m.from_user_id = u.id
        WHERE m.room = ?
        ORDER BY m.created_at DESC LIMIT 100
    ''', (room,)).fetchall()
    conn.close()
    return jsonify([dict(m) for m in reversed(msgs)])

@app.route('/api/messages', methods=['POST'])
def send_message():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    data = request.json
    content = data.get('content', '').strip()
    room = data.get('room', 'general')
    if not content:
        return jsonify({'error': 'Mensaje vacío'})
    conn = get_db()
    conn.execute(
        'INSERT INTO messages (from_user_id, room, content) VALUES (?, ?, ?)',
        (session['user_id'], room, content)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/messages/<int:msg_id>', methods=['DELETE'])
def delete_message(msg_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    msg = conn.execute('SELECT from_user_id FROM messages WHERE id = ?', (msg_id,)).fetchone()
    if not msg:
        conn.close()
        return jsonify({'error': 'No encontrado'}), 404
    if msg['from_user_id'] != session['user_id'] and session.get('email') != ADMIN_EMAIL:
        conn.close()
        return jsonify({'error': 'No autorizado'}), 403
    
    conn.execute('DELETE FROM messages WHERE id = ?', (msg_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ── Trades API ────────────────────────────────────────────────────────────────
@app.route('/api/trades', methods=['GET'])
def get_trades():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    trades = conn.execute('''
        SELECT t.*, 
               fu.nombre as from_nombre, fu.apellido as from_apellido, fu.lote as from_lote,
               tu.nombre as to_nombre, tu.apellido as to_apellido, tu.lote as to_lote
        FROM trades t
        JOIN users fu ON t.from_user_id = fu.id
        JOIN users tu ON t.to_user_id = tu.id
        WHERE t.from_user_id = ? OR t.to_user_id = ?
        ORDER BY t.created_at DESC
    ''', (session['user_id'], session['user_id'])).fetchall()
    conn.close()
    return jsonify([dict(t) for t in trades])

@app.route('/api/trades', methods=['POST'])
def create_trade():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    data = request.json
    to_user_id = data.get('to_user_id')
    from_stickers = json.dumps(data.get('from_stickers', []))
    to_stickers = json.dumps(data.get('to_stickers', []))
    message = data.get('message', '')

    conn = get_db()
    conn.execute('''INSERT INTO trades (from_user_id, to_user_id, from_stickers, to_stickers, message)
        VALUES (?, ?, ?, ?, ?)''',
        (session['user_id'], to_user_id, from_stickers, to_stickers, message)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/trades/<int:trade_id>', methods=['PATCH'])
def update_trade(trade_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    data = request.json
    status = data.get('status')
    conn = get_db()
    trade = conn.execute('SELECT * FROM trades WHERE id = ?', (trade_id,)).fetchone()
    if not trade:
        return jsonify({'error': 'No encontrado'}), 404
    if trade['to_user_id'] != session['user_id'] and trade['from_user_id'] != session['user_id']:
        return jsonify({'error': 'Sin permiso'}), 403
    conn.execute('UPDATE trades SET status = ? WHERE id = ?', (status, trade_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ── Juntadas API ──────────────────────────────────────────────────────────────
@app.route('/api/juntadas', methods=['GET'])
def get_juntadas():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    conn = get_db()
    juntadas = conn.execute('''
        SELECT j.*, u.nombre as creator_nombre, u.apellido as creator_apellido,
               COUNT(r.id) as asistentes
        FROM juntadas j
        JOIN users u ON j.created_by = u.id
        LEFT JOIN juntada_rsvp r ON j.id = r.juntada_id AND r.status = 'going'
        GROUP BY j.id
        ORDER BY j.fecha ASC
    ''').fetchall()
    result = []
    for j in juntadas:
        d = dict(j)
        rsvp = conn.execute(
            'SELECT status FROM juntada_rsvp WHERE juntada_id = ? AND user_id = ?',
            (j['id'], session['user_id'])
        ).fetchone()
        d['my_rsvp'] = rsvp['status'] if rsvp else None
        result.append(d)
    conn.close()
    return jsonify(result)

@app.route('/api/juntadas', methods=['POST'])
def create_juntada():
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    if session['email'] != ADMIN_EMAIL:
        return jsonify({'error': 'Sin permisos de admin'}), 403
    data = request.json
    conn = get_db()
    conn.execute('''INSERT INTO juntadas (titulo, descripcion, fecha, lugar, created_by)
        VALUES (?, ?, ?, ?, ?)''',
        (data['titulo'], data.get('descripcion', ''), data['fecha'], data['lugar'], session['user_id'])
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/juntadas/<int:juntada_id>/rsvp', methods=['POST'])
def rsvp_juntada(juntada_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    data = request.json
    status = data.get('status', 'going')
    conn = get_db()
    conn.execute('''INSERT INTO juntada_rsvp (juntada_id, user_id, status)
        VALUES (?, ?, ?)
        ON CONFLICT(juntada_id, user_id) DO UPDATE SET status=excluded.status''',
        (juntada_id, session['user_id'], status)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/session', methods=['GET'])
def get_session():
    if 'user_id' not in session:
        return jsonify({'authenticated': False})
    return jsonify({
        'authenticated': True,
        'user_id': session['user_id'],
        'nombre': session['nombre'],
        'lote': session['lote'],
        'email': session['email'],
        'is_admin': session['email'] == ADMIN_EMAIL
    })

if __name__ == '__main__':
    init_db()
    print("Figuritas del Mundial 2026 corriendo en http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
