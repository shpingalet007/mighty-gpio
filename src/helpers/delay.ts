export default function delay(func: () => any, time: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(func()), time);
  });
}
