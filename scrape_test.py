import json
from bs4 import BeautifulSoup
import requests

# Function to scrape and follow the URL in a <link> tag
def find_link_tag(url, type):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the <link> tag 
        match type:
            case 'spur_nationals':
                #non-week nationals
                spur_nationals = soup.find_all("a", class_="item-link", href=lambda href: href and "coverage/week" in href)
                link_url = []
                for national in spur_nationals:
                    if 'href' in national.attrs:
                        link_url.append(national['href'])
                    else:
                        print("No matching <a> tag with 'coverage' in href found for national: " + national)
                link_url = list(set(link_url))
            case 'week_nationals':
                #week nationals
                week_nationals = soup.find_all("a", class_="item-link", href=lambda href: href and "coverage/national-championship-2025-coverage-week-" in href)
                link_url = []
                for national in week_nationals:
                    if 'href' in national.attrs:
                        link_url.append(national['href'])
                    else:
                        print("No matching <a> tag with 'coverage' in href found for national: " + national)
                link_url = list(set(link_url))
            case 'national':
                link_tag = soup.find("a", class_="item-link", href=lambda href: href and "coverage" in href)
                if link_tag and 'href' in link_tag.attrs:
                    link_url = link_tag['href']
                else:
                    print("No matching <a> tag with 'coverage' in href found.")
                    return None
            case "coverage":
                table = soup.table.find_all("tr")
                row = table[1] if len(table) > 1 else None
                cells = row.find_all("td")
                if cells[0].get_text(separator=" ", strip=True) != "Round 1 - Classic Constructed":
                    print("First row is not Round 1 - Classic Constructed, but " + cells[0].text)
                    return None
                pairings = "https://fabtcg.com" + cells[2].a["href"]
                standings = "https://fabtcg.com" + cells[3].a["href"]
                link_url = {"standings": standings, "pairings": pairings}
                    
        
        #print(f"Found URL in <link> tag: {link_url}")
        return link_url
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def extract_data(url):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the <link> tag
        table = soup.table.find_all("tr")
        decklists = {}
        for row in table[1:]:
            cells = row.find_all("td")
            #rank = cells[0].text.strip()
            #player = cells[1].text.strip()
            try:
                decklist_link = cells[3].a["href"] if cells[3].a else None
            except:
                decklist_link = None
                print("No decklist link found for row: " + str(row))
            #decklists[player] = {"rank": rank, "decklist": decklist_link}
            if decklist_link:
                decklist = get_decklist("https://fabtcg.com" + decklist_link)
                decklists[get_decklist_name(decklist)] = decklist
        
        #print(f"Extracted decklists: {decklists}")
        return decklists
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def get_decklist(url):
    try:
        # Fetch the HTML content of the page
        headers = {"Content-Language": "en"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the <link> tag
        tables = soup.find_all("table")
        metadata_table = tables[0]
        
        #Table 1 Metadata extraction
        rows = metadata_table.find_all("tr")
        metadata = {}
        for row in rows:
            key = row.th.text.strip()
            if key != "Player Name / ID":
                value = row.td.get_text(separator=" ", strip=True)
                metadata[key] = value
            else:
                player_info = row.td.get_text(separator=" ", strip=True)
                try:
                    metadata["Player Name"] = player_info[:-11]
                    metadata["ID"] = player_info[-9:-1]
                except:
                    print("Error parsing Player Name / ID, Player Name is: " + player_info + ", ID set to empty string")
                    metadata["Player Name"] = player_info
                    metadata["ID"] = ""
        
        #Initialize decklist structure
        decklist = {"metadata": metadata, "cards": []}
        
        #Decklist extraction
        for table in tables[1:]:
            rows = table.find_all("tr")
            pitch = rows[0].th.get_text(separator=" ", strip=True)
            if not ("Pitch" in pitch or pitch == "Hero / Weapon / Equipment"):  # Ensure it's a valid pitch header   
                break
            for row in rows[1:]:  # Skip header row
                div = row.td.div
                quantity = div.get_text(separator=" ", strip=True)[0]
                card_name = div.a.get_text(separator=" ", strip=True)
                if not(pitch[-1] == "0" or pitch == "Hero / Weapon / Equipment"):
                    color = card_name[-4:-1].capitalize()
                    card_name = card_name[:-6]
                else:
                    color = ""
                decklist["cards"].append({"color": color, "quantity": quantity, "card_name": card_name})
        
        #print(f"Extracted decklist: {decklist}")
        return decklist
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None
    
def get_decklist_name(decklist):
    return decklist["metadata"]["ID"] + " - " + decklist["metadata"]["Date"] + " - " + decklist["metadata"]["Event"]

# Example usage
if __name__ == "__main__":
    page_url = "https://fabtcg.com/en/articles/national-championships-2025-live-streams"  # Replace with the URL of the page to scrape
    spur_nationals = find_link_tag(page_url, "spur_nationals")
    page_url = "https://fabtcg.com/en/organised-play/2025/national-championships-2025/coverage/national-championship-2025-coverage-week-1/"
    week1_nationals = find_link_tag(page_url, "week_nationals")
    page_url = "https://fabtcg.com/en/organised-play/2025/national-championships-2025/coverage/national-championship-2025-coverage-week-2/"
    week2_nationals = find_link_tag(page_url, "week_nationals")
    nationals = spur_nationals + week1_nationals + week2_nationals
    nationals = list(set(nationals))
    
    decklists = []
    for national in nationals:
        print("Processing national: " + national)
        coverage = find_link_tag(national, "national") if national else None
        coverage_details = find_link_tag(coverage, "coverage") if coverage else None
        #print(coverage_details)
        new_decklists = extract_data(coverage_details["standings"]) if coverage_details else None
        decklists = decklists + new_decklists if new_decklists else decklists
    json_object = json.dumps(decklists, indent=4)
    with open("nationals_decklists_no_USA.json", "w") as outfile:
        outfile.write(json_object)
    #decklists = add_results(coverage_details["pairings"], decklists) if coverage_details else None
    
    