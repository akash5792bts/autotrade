const axios = require("axios");
const moment = require("moment");
const talib = require('ta-lib');
const _ = require('lodash');
const ExcelJS = require('exceljs');


class DataProcessor {
  constructor() {
    // You can initialize any properties or configurations here.
  }

  async callExternalApi(apiUrl) {
    try {
      const response = await axios.get(apiUrl);
      return response.data;
    } catch (error) {
      throw new Error(`Error calling external API: ${error.message}`);
    }
  }

  async convertToExcel(data, excelFileName) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet 1");

    // Assuming data is an array of objects with similar structure
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    data.forEach((item) => {
      worksheet.addRow(Object.values(item));
    });

    try {
      await workbook.xlsx.writeFile(excelFileName);
      console.log(
        `Excel file "${excelFileName}" has been created successfully.`
      );
    } catch (error) {
      throw new Error(`Error writing Excel file: ${error.message}`);
    }
  }

  identifyFirst30MinuteCandles(data) {
    let date = new Date(data[0]['timestamp'])
    // console.log(date)
    let dayHigh = -Math.pow(10, 6);
    let dayLow = Math.pow(10, 6);
    let dayMid = 0;
    
    for (const i in data) {
      
      const candle = data[i];
      const timestamp = new Date(candle.timestamp);
      // console.log(' cond ', date != timestamp)
      const hours = timestamp.getHours();
      const minutes = timestamp.getMinutes();

      if(date.toDateString() != timestamp.toDateString()) {
        date = new Date(candle.timestamp);
        dayHigh = -Math.pow(10, 6);
        dayLow = Math.pow(10, 6);
        dayMid = 0;
      }

      // Check if the time is greater than 9:00 AM and less than or equal to 9:30 AM
      if (hours === 9 && minutes >= 0 && minutes <= 30) {
        const date = timestamp.toDateString(); // Extracting the date part
        data[i]['dayHigh'] = dayHigh;
        data[i]['dayMid'] = dayMid;
        data[i]['dayLow'] = dayLow;
        dayHigh = Math.max(candle.high, dayHigh)
        dayLow = Math.min(candle.low, dayLow)
        dayMid = _.mean([dayHigh, dayLow]);
        // if (!groupedByDay[date]) {
        //   groupedByDay[date] = [];
        // }

        // groupedByDay[date].push(candle);

        // // Break after processing the first 30 minutes of each day
        // if (groupedByDay[date].length >= 30) {
        //   break;
        // }
      } else {
        data[i]['dayHigh'] = dayHigh;
        data[i]['dayMid'] = dayMid;
        data[i]['dayLow'] = dayLow;
      }
    }

    return data;
  }

  isCrossunder(shortTermValues, longTermValues) {
    const length = Math.min(shortTermValues.length, longTermValues.length);
  
    for (let i = 1; i < length; i++) {
      const shortTermPrev = shortTermValues[i - 1];
      const longTermPrev = longTermValues[i - 1];
      const shortTermCurrent = shortTermValues[i];
      const longTermCurrent = longTermValues[i];
  
      // Check for crossunder condition
      if (shortTermPrev > longTermPrev && shortTermCurrent <= longTermCurrent) {
        return true; // Crossunder occurred
      }
    }
  
    return false; // No crossunder
  }

  getNextNonWeekendDay(date) {
    const dayOfWeek = date.getDay();
    const daysToAdd = dayOfWeek === 5 ? 2 : dayOfWeek === 6 ? 1 : 0; // Skip Saturday or Sunday
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + daysToAdd + 1); // Add days to reach the next non-weekend day
    nextDay.setHours(9, 0, 0, 0); // Set time to 9:00 AM
    return nextDay;
  }
  

  async process() {
    try {

      // Get the current date and time
      const now = new Date();

      // Set the target time to 9:00 AM
      // const targetTime = new Date(now);
      const targetTime = this.getNextNonWeekendDay(now);
      targetTime.setHours(9, 0, 0, 0); // Set hours to 9, minutes to 0, seconds to 0, milliseconds to 0

      const duration = '3';
      // Calculate the difference in minutes
      const timeDifferenceInMinutes = Math.floor((targetTime - now) / (1000 * 60));
      // const countback = 9950;
      // const countback = 2267;
      const countback = (Math.abs(Math.round(timeDifferenceInMinutes/Number(duration)))-5).toString();
      console.log('countback', countback)


      const fromdateTimeString = targetTime;
      const from = moment(fromdateTimeString, "YYYY-MM-DD HH:mm:ss").unix();
      const todateTimeString = new Date();
      // const todateTimeString = "2024-01-25 15:30:05";
      const to = moment(todateTimeString, "YYYY-MM-DD HH:mm:ss").unix();
      // console.log(to)
      
      
      // Call external API

      // const symbol = "HDFCBANK";
      const symbol = "ICICIBANK";
      const url = `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${symbol}&resolution=${duration}&from=${from}&to=${to}&countback=${countback}&currencyCode=INR`;

      // nifty
      // const symbol = "in;NSX";
      // Bank nifty
      // const symbol = "in;nbx";
      // const url = `https://priceapi.moneycontrol.com/techCharts/indianMarket/index/history?symbol=${symbol}&resolution=${duration}&from=${from}&to=${to}&countback=${countback}&currencyCode=INR`;
      
      
      
      // https://priceapi.moneycontrol.com//techCharts/indianMarket/index/history?symbol=in%3BNSX&resolution=3&from=1705948664&to=1706167323&countback=329&currencyCode=INR
      // console.log(url)
      const data = await this.callExternalApi(url);
      // console.log("API Data:", data);
      
      // ema
      const ema5 = talib.EMA(data.c, 5);
      const ema10 = talib.EMA(data.c, 10);
      const ema15 = talib.EMA(data.c, 15);
      const ema20 = talib.EMA(data.c, 20);
       


      let res = data.t.map((item, i) => ({
        timestamp: moment.unix(item).format("YYYY-MM-DD HH:mm:ss"),
        open: data["o"][i],
        high: data["h"][i],
        low: data["l"][i],
        close: data["c"][i],
        volume: data["v"][i],
        ema5: i >= 5 ? Number(ema5[i-5].toFixed(2)) : 0,
        ema10: i >= 10 ? Number(ema10[i-10].toFixed(2)) : 0,
        ema15: i >= 15 ? Number(ema15[i-15].toFixed(2)) : 0,
        ema20: i >= 20 ? Number(ema20[i-20].toFixed(2)) : 0,
      }));

      for (const i in res) {
        if (res[i]) {
          const candle = res[i];
          res[i]['trend'] = 'side';
          if(res[i]['ema5'] >= res[i]['ema10'] && res[i]['ema10'] >= res[i]['ema15'] && res[i]['ema15'] >= res[i]['ema20'] ) {
            res[i]['trend'] = 'up'
          }
          
          if(res[i]['ema5'] <= res[i]['ema10'] && res[i]['ema10'] <= res[i]['ema15'] && res[i]['ema15'] <= res[i]['ema20'] ) {
            res[i]['trend'] = 'down'
          }
        }
      }
      
      res = this.identifyFirst30MinuteCandles(res);


      // Convert to Excel
      const excelFileName = new Date().getTime()+"-output.xlsx";
      await this.convertToExcel(res, excelFileName);

      console.log("Processing completed successfully.");
    } catch (error) {
      console.error(error.message);
    }
  }
}

// Example usage:
const dataProcessor = new DataProcessor();
dataProcessor.process();
