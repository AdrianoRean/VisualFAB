from bs4 import BeautifulSoup
import requests

# Function to scrape and follow the URL in a <link> tag
def find_link_tag(url):
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
            case 'all_nationals':
                all_nationals = soup.find_all("a", class_="item-link", href=lambda href: href and "coverage" in href)
                link_tag = all_nationals[0] if all_nationals else None
                if link_tag and 'href' in link_tag.attrs:
                    link_url = link_tag['href']
                else:
                    print("No matching <a> tag with 'coverage' in href found.")
                    return None
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
                standings = row.find_all("td")[3].a["href"]
                pairings = []
                for row in table[1:0]:
                    pairings.append(row.find_all("td")[2].a["href"])
                link_url = {"standings": standings, "pairings": pairings}
                    
        
        print(f"Found URL in <link> tag: {link_url}")
        return link_url
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None

# Example usage
if __name__ == "__main__":
    page_url = "https://fabtcg.com/en/articles/national-championships-2025-live-streams"  # Replace with the URL of the page to scrape
    first_national = find_link_tag(page_url, "all_nationals")
    coverage = find_link_tag(first_national, "national") if first_national else None
    coverage_details = find_link_tag(coverage, "coverage") if coverage else None
    decklists = extract_data(coverage_details["standings"]) if coverage_details else None
    decklists = add_results(coverage_details["pairings"], decklists) if coverage_details else None
    
    