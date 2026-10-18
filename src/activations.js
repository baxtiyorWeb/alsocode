/**
 * Aktivatsiya funksiyalari va ularning hosilalari
 */
class Activation {
  /**
   * Sigmoid funksiyasi: Kiruvchi sonni (0, 1) oraliqqa keltiradi
   * @param {number} x
   * @returns {number}
   */
  static sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Sigmoid hosilasi (Gradient uchun)
   * @param {number} y - allaqachon sigmoid(x) bo'lgan qiymat
   * @returns {number}
   */
  static sigmoidDerivative(y) {
    return y * (1 - y);
  }
}

/**
 * Boshlang'ich tasodifiy vaznlar generatsiyasi (-1 dan 1 gacha)
 */
function randomWeight() {
  return Math.random() * 2 - 1;
}

module.exports = {
  Activation,
  randomWeight,
};
