"use strict";
// utils/helpers.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFutureDate = exports.calculateDaysBetween = void 0;
const calculateDaysBetween = (d1, d2) => {
    const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
exports.calculateDaysBetween = calculateDaysBetween;
const getFutureDate = (startDate, days) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + days);
    return date;
};
exports.getFutureDate = getFutureDate;
// You can add more helper functions here for things like
// - Sanitizing user input
// - Formatting dates
// - Etc.
