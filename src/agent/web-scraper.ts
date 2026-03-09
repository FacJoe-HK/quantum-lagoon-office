import axios from 'axios';
import * as cheerio from 'cheerio';
import { search, SafeSearchType } from 'duck-duck-scrape';

export class WebScraper {
    /**
     * Search DuckDuckGo for a query and return top results.
     */
    async searchWeb(query: string, maxResults: number = 5): Promise<string> {
        try {
            const results = await search(query, {
                safeSearch: SafeSearchType.MODERATE
            });

            if (!results.results || results.results.length === 0) {
                return "No results found for your query.";
            }

            let out = `--- Search Results for "${query}" ---\n\n`;
            const topResults = results.results.slice(0, maxResults);

            for (let i = 0; i < topResults.length; i++) {
                const r = topResults[i];
                out += `${i + 1}. [${r.title}](${r.url})\n`;
                out += `   Snippet: ${r.description}\n\n`;
            }
            return out;
        } catch (e: any) {
            return `Failed to search web: ${e.message}`;
        }
    }

    /**
     * Fetch a URL and extract its main text content using Cheerio.
     */
    async readUrl(url: string): Promise<string> {
        try {
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                timeout: 15000
            });

            const $ = cheerio.load(data);

            // Remove scripts, styles, and non-content elements
            $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();

            // Extract text from paragraphs and headers
            let content = '';
            $('h1, h2, h3, h4, p, li').each((_, el) => {
                const text = $(el).text().trim().replace(/\s+/g, ' ');
                if (text.length > 0) {
                    content += text + '\n\n';
                }
            });

            if (!content) {
                // Fallback to body text if structured elements are missing
                content = $('body').text().trim().replace(/\s+/g, ' ');
            }

            // Truncate to avoid blowing up the LLM context (approx 5000 words max)
            const maxLength = 25000;
            if (content.length > maxLength) {
                content = content.substring(0, maxLength) + '\n\n[...Content truncated due to length...]';
            }

            return `--- Content from ${url} ---\n\n${content}`;

        } catch (e: any) {
            return `Failed to read URL ${url}: ${e.message}`;
        }
    }
}
