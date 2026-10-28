export async function readFile(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    // readAsText 使 result 一定是字符串
    reader.readAsText(file);
  });
}
