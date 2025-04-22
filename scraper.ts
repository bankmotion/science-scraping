import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

// Function to extract year from different date formats
const extractYearFromDate = (
  date: string | null | undefined
): number | null => {
  if (!date) return null;

  const dateParts = date.split(" ");

  if (dateParts.length === 2) {
    const year = parseInt(dateParts[1], 10);
    return isNaN(year) ? null : year;
  }

  if (dateParts.length === 1) {
    const year = parseInt(dateParts[0], 10);
    return isNaN(year) ? null : year;
  }

  if (dateParts.length === 3) {
    const year = parseInt(dateParts[2], 10);
    return isNaN(year) ? null : year;
  }

  return null;
};

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms * 1000));

const scrapeArticles = async (query: string) => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
      ],
    });
    const page = await browser.newPage();

    let currentPage = 1;

    while (true) {
      const searchUrl = `https://www.sciencedirect.com/search?qs=${query}&show=100&offset=${
        (currentPage - 1) * 100
      }`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

      await page.waitForSelector(".result-item-container");

      const articles = await page.evaluate(() => {
        const items = Array.from(
          document.querySelectorAll(".result-item-container")
        );
        return items.map((item) => {
          const linkElement = item.querySelector(
            "a.result-list-title-link"
          ) as HTMLAnchorElement;
          const title = linkElement ? linkElement.href : null;
          const dateElement = item.querySelector(
            ".SubType .srctitle-date-fields>span:last-child"
          );
          const date = dateElement ? dateElement.textContent?.trim() : null;
          return { title, date };
        });
      });

      if (articles.length === 0) break;
      currentPage++;

      const filteredArticles = articles.filter((article) => {
        const year = extractYearFromDate(article.date);
        return year && year >= 2015 && year <= 2020;
      });
      console.log(filteredArticles);

      for (let i = 0; i < filteredArticles.length; i++) {
        const link = filteredArticles[i];
        if (!link.title) continue;

        await page.goto(link.title, { waitUntil: "domcontentloaded" });
        await delay(2);

        const articleDOI = await page.evaluate(() => {
          const doiLink = document.querySelector(
            "a.anchor.doi"
          ) as HTMLAnchorElement;
          return doiLink ? doiLink.href.split("doi.org/")[1] : null;
        });

        if (!articleDOI) continue;

        const sciHubUrl = `https://sci-hub.st/https://doi.org/${articleDOI}`;

        await page.goto(sciHubUrl, { waitUntil: "domcontentloaded" });
        await delay(2);

        const pdfLink = await page.evaluate(() => {
          const embedElement = document.querySelector(
            "embed"
          ) as HTMLEmbedElement;
          return embedElement ? embedElement.getAttribute("src") : null;
        });
        console.log(pdfLink);

        if (pdfLink) {
          console.log(`Found PDF, starting download`, pdfLink);
          await downloadPDF("https://sci-hub.st" + pdfLink, articleDOI);
        } else {
          console.log(`No PDF for DOI: ${articleDOI}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching search results`, error);
  }
};

const downloadPDF = async (pdfUrl: string, doi: string) => {
  try {
    const res = await axios.get(pdfUrl, { responseType: "stream" });
    const filePath = path.resolve(
      __dirname,
      `./pdfs/${new Date().getTime()}.pdf`
    );
    const writer = fs.createWriteStream(filePath);

    res.data.pipe(writer);

    writer.on("finish", () => {
      console.log("Downloaded PDF");
    });

    writer.on("error", (error) => {
      console.error(`Error downloading ${doi}.pdf`, error);
    });
  } catch (error) {
    console.error(`Failed to download PDF for ${error}`);
  }
};

const main = async (query: string) => {
  const searchResults = await scrapeArticles(query);
  // console.log(searchResults);
};

main("math");
