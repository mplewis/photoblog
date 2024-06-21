import { glob } from "glob";
import path from "node:path";

const albumRe = /(^.+)\/.+$/;
const photosetRe = /(^.+)_([^.]+).[A-Za-z]+$/;

const screenSizes = [
  { size: "s3", width: 450, columns: 3 },
  { size: "s4", width: 600, columns: 4 },
  { size: "s5", width: 750, columns: 5 },
  { size: "s6", width: 900, columns: 6 },
  { size: "s7", width: 1050, columns: 7 },
  { size: "s8", width: 1200, columns: 8 },
  { size: "s9", width: 1350, columns: 9 },
  { size: "s10", width: 1500, columns: 10 },
  { size: "s11", width: 1650, columns: 11 },
  { size: "s12", width: 1800, columns: 12 },
] as const;

const thumbSizes = [
  { size: "w180", width: 180 },
  { size: "w216", width: 216 },
  { size: "w270", width: 270 },
  { size: "w324", width: 324 },
  { size: "w396", width: 396 },
  { size: "w486", width: 486 },
  { size: "w594", width: 594 },
  { size: "w702", width: 702 },
  { size: "w846", width: 846 },
] as const;

const albumDescs = {
  bwca: { name: "Boundary Waters", desc: "Boundary Waters Canoe Area" },
  japan: {
    name: "Japan",
    desc: "Photos from Japan: Tokyo, Kyoto, Hiroshima, and Osaka",
  },
  europe: { name: "Europe", desc: "Photos from France and Iceland" },
  home: {
    name: "Colorado",
    desc: "Photos taken near where I live in Colorado",
  },
} as const;

const sourceSizes = screenSizes
  .map(
    ({ width, columns }) =>
      `(max-width: ${width - 1}px) ${(100 / columns).toFixed(2)}vw`
  )
  .join(",\n");

const paths = await glob("public/photos/**/*.jpg");
const urls = paths.map((p) => path.relative("public", p));

const albums: Record<string, Set<string>> = {};
urls.forEach((url) => {
  const match1 = albumRe.exec(url);
  const match2 = photosetRe.exec(url);
  if (match1 && match2) {
    const [, album] = match1;
    const [, photoset] = match2;
    if (!album || !photoset) return;

    const a = path.relative("photos", album);
    if (!albums[a]) albums[a] = new Set();
    albums[a]!.add(photoset);
  }
});

const grouped: Record<string, Record<string, string>> = {};
urls.sort();
urls.forEach((url) => {
  const match = photosetRe.exec(url);
  if (match) {
    const [, photoset, size] = match;
    if (!photoset || !size) return;
    if (!grouped[photoset]) grouped[photoset] = {};
    grouped[photoset]![size] = url;
  }
});

const Index = () => (
  <>
    <div className="fixed bg-white pt-4 pb-1 px-2 block w-full">
      <div className="flex items-end justify-between">
        <div>
          <span className="site-logo inline-block text-5xl">Photolog</span>
          <span className="inline-block ml-1">by Matt Lewis</span>
        </div>
        <div>
          {Object.entries(albumDescs).map(([, { name }]) => (
            <button className="px-4 text-sky-700 hover:text-sky-500 transition-all">
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
    <div className="pt-24 grid grid-cols-3 s4:grid-cols-4 s5:grid-cols-5 s6:grid-cols-6 s7:grid-cols-7 s8:grid-cols-8 s9:grid-cols-9 s10:grid-cols-10 s11:grid-cols-11 s12:grid-cols-12">
      {Object.entries(grouped).map(([, urls]) => (
        <div className="aspect-square">
          <picture>
            <source
              type="image/jpeg"
              sizes={sourceSizes}
              srcset={thumbSizes
                .map(({ size, width }) => `${urls[size]} ${width}w`)
                .join(", ")}
            />
            <img className="w-full h-full object-cover" />
          </picture>
        </div>
      ))}
    </div>
  </>
);

export default Index;
