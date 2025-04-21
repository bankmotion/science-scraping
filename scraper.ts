import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

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

    const searchUrl = `https://www.sciencedirect.com/search?qs=${query}&show=100&offset=0`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    await page.waitForSelector(".result-item-container");

    const articleLinks = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll(
          ".result-item-container a.result-list-title-link"
        )
      );
      return links.map((link) => (link as HTMLAnchorElement).href);
    });

    console.log(articleLinks);

    // for (let i = 0; i < articleLinks.length; i++) {
    //   const link = articleLinks[i];
    //   const articleDOI = link.split("/").pop();

    //   if (!articleDOI) continue;

    //   const sciHubUrl = `https://sci-hub.st/https://doi.org/${articleDOI}`;

    //   await page.goto(sciHubUrl, { waitUntil: "domcontentloaded" });

    //   const pdfLink = await page.evaluate(() => {
    //     const embedElement = document.querySelector("embed");
    //     return embedElement ? embedElement.getAttribute("src") : null;
    //   });

    //   if (pdfLink) {
    //     console.log(`Found PDF, starting download`);
    //     await downloadPDF(pdfLink, articleDOI);
    //   } else {
    //     console.log(`No PDF for DOI: ${articleDOI}`);
    //   }
    // }
    return articleLinks;
  } catch (error) {
    console.error(`Error fetching search results`, error);
  }
};

const downloadPDF = async (pdfUrl: string, doi: string) => {
  try {
    const res = await axios.get(pdfUrl, { responseType: "stream" });
    const filePath = path.resolve(__dirname, `./pdfs/${doi}.pdf`);
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
  console.log(searchResults);
};

main("psychology");
