onmessage = (e) => {
  console.time("doSomething");
  console.log("Message received from main script");
  let maxCount = 1000000000;
  let i = 0;
  while (maxCount-- > 0) {
    i++;
  }
  const workerResult = `Result: ${i}`;
  console.log("Posting message back to main script");
  console.timeEnd("doSomething");

  postMessage(workerResult);
};
