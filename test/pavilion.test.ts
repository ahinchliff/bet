import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { Signer, BigNumber } from "ethers";
import { expect } from "chai";
import { Pavilion } from "../typechain/Pavilion";
import getForkingConfig from "../utils/get-forking-config";
import daiAbi from "../abi/dai";

const IN_A_WEEK = new Date();
IN_A_WEEK.setDate(IN_A_WEEK.getDate() + 7);

const IN_A_WEEK_PLUS_ONE_SECOND = new Date(IN_A_WEEK.getTime() + 1);

const GAME_NAME = "Game 1";
const GAME_CLOSE_TIME = IN_A_WEEK.getTime();
const GAME_POSITIVE_PRICE = 70;
const GAME_NEGATIVE_PRICE = 30;
const GAME_POSTIVE_MAX_QUANTITY = 100;
const GAME_NEGATIVE_MAX_QUANTITY = 50;
const DAI_MAINNET_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const DAI_WHALE_ADDRESS = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";
const NEW_GAME_POSITIVE_PRICE = 60;
const NEW_GAME_NEGATIVE_PRICE = 30;
const NEW_GAME_POSTIVE_MAX_QUANTITY = 10;
const NEW_GAME_NEGATIVE_MAX_QUANTITY = 20;
const POSITIVE_BUY_AMOUNT = 10;
const NEGATIVE_BUY_AMOUNT = 5;

const directionEnum = {
  NOT_SET: 0,
  POSITIVE: 1,
  NEGATIVE: 2,
};

const statusEnum = {
  OPEN: 0,
  FORCED_CLOSE: 1,
  CANCELLED: 2,
};

const createGame = (pavilion: Pavilion, signer: Signer) =>
  pavilion
    .connect(signer)
    .createGame(
      GAME_NAME,
      GAME_CLOSE_TIME,
      GAME_POSITIVE_PRICE,
      GAME_NEGATIVE_PRICE,
      GAME_POSTIVE_MAX_QUANTITY,
      GAME_NEGATIVE_MAX_QUANTITY
    );

const buyTicket = (pavilion: Pavilion, signer: Signer) =>
  pavilion
    .connect(signer)
    .buyTickets(
      1,
      directionEnum.POSITIVE,
      POSITIVE_BUY_AMOUNT,
      GAME_POSITIVE_PRICE
    );

describe("Pavilion", function () {
  let owner: Signer;
  let nonOwner: Signer;
  let contract: Pavilion;

  beforeEach(async function () {
    const [tempOwner, tempNonOwner] = await ethers.getSigners();
    owner = tempOwner;
    nonOwner = tempNonOwner;

    const Contract = await ethers.getContractFactory("Pavilion", owner);
    contract = (await Contract.deploy(DAI_MAINNET_ADDRESS)) as Pavilion;
    await contract.deployed();
  });

  describe(".createGame", function () {
    it("Should stop a stranger from creating a game", async function () {
      await expectRevertSenderIsNotOwner(() => createGame(contract, nonOwner));
    });

    it("Should create game with expected values", async function () {
      await createGame(contract, owner);
      const game = await contract.games(1);

      expect(game.name).to.eq(GAME_NAME);
      expect(game.outcome).to.equal(directionEnum.NOT_SET);
      expect(game.status).to.equal(statusEnum.OPEN);
      expect(game.closesAt).to.eq(GAME_CLOSE_TIME);
      expect(game.prices.positive).to.eq(GAME_POSITIVE_PRICE);
      expect(game.prices.negative).to.eq(GAME_NEGATIVE_PRICE);
      expect(game.maxQuantity.positive).to.eq(GAME_POSTIVE_MAX_QUANTITY);
      expect(game.maxQuantity.negative).to.eq(GAME_NEGATIVE_MAX_QUANTITY);
    });
  });

  describe(".setGameStatus", function () {
    it("Should stop a stranger from setting a game's status", async function () {
      await createGame(contract, owner);

      await expectRevertSenderIsNotOwner(async () =>
        contract.connect(nonOwner).setGameStatus(1, statusEnum.OPEN)
      );
    });

    it("Should correctly set the game's status", async function () {
      await createGame(contract, owner);

      await contract.connect(owner).setGameStatus(1, statusEnum.OPEN);
      expect((await contract.games(1)).status).to.eq(statusEnum.OPEN);

      await contract.connect(owner).setGameStatus(1, statusEnum.CANCELLED);
      expect((await contract.games(1)).status).to.eq(statusEnum.CANCELLED);

      await contract.connect(owner).setGameStatus(1, statusEnum.FORCED_CLOSE);
      expect((await contract.games(1)).status).to.eq(statusEnum.FORCED_CLOSE);
    });
  });

  describe(".setGamePrices", function () {
    it("Should stop a stranger from setting a game's prices", async function () {
      await createGame(contract, owner);

      await expectRevertSenderIsNotOwner(async () =>
        contract.connect(nonOwner).setGamePrices(1, 60, 40)
      );
    });

    it("Should correctly set the game's prices", async function () {
      await createGame(contract, owner);

      await contract
        .connect(owner)
        .setGamePrices(1, NEW_GAME_POSITIVE_PRICE, NEW_GAME_NEGATIVE_PRICE);

      expect((await contract.games(1)).prices.positive).to.eq(
        NEW_GAME_POSITIVE_PRICE
      );

      expect((await contract.games(1)).prices.negative).to.eq(
        NEW_GAME_NEGATIVE_PRICE
      );
    });
  });

  describe(".setGameMaxQuantity", function () {
    it("Should stop a stranger from setting a game's max quantity", async function () {
      await createGame(contract, owner);

      await expectRevertSenderIsNotOwner(async () =>
        contract
          .connect(nonOwner)
          .setGameMaxQuantity(
            1,
            NEW_GAME_POSTIVE_MAX_QUANTITY,
            NEW_GAME_NEGATIVE_MAX_QUANTITY
          )
      );
    });

    it("Should correctly set the game's max quantity", async function () {
      await createGame(contract, owner);

      await contract
        .connect(owner)
        .setGameMaxQuantity(
          1,
          NEW_GAME_POSTIVE_MAX_QUANTITY,
          NEW_GAME_NEGATIVE_MAX_QUANTITY
        );

      expect((await contract.games(1)).maxQuantity.positive).to.eq(
        NEW_GAME_POSTIVE_MAX_QUANTITY
      );

      expect((await contract.games(1)).maxQuantity.negative).to.eq(
        NEW_GAME_NEGATIVE_MAX_QUANTITY
      );
    });
  });

  describe(".setGameOutcome", function () {
    it("Should stop a stranger from setting a game's outcome", async function () {
      await createGame(contract, owner);

      await expectRevertSenderIsNotOwner(async () =>
        contract.connect(nonOwner).setGameOutcome(1, directionEnum.POSITIVE)
      );
    });

    it("Should correctly set the game's outcome", async function () {
      await createGame(contract, owner);

      await contract.connect(owner).setGameOutcome(1, directionEnum.NEGATIVE);
      expect((await contract.games(1)).outcome).to.eq(directionEnum.NEGATIVE);

      await contract.connect(owner).setGameOutcome(1, directionEnum.POSITIVE);
      expect((await contract.games(1)).outcome).to.eq(directionEnum.POSITIVE);
    });
  });

  describe(".buyTickets", function () {
    it("Should stop a user buying tickets when a game is cancelled or forced closed", async function () {
      await createGame(contract, owner);

      await contract.connect(owner).setGameStatus(1, statusEnum.CANCELLED);
      await expectRevert(() => buyTicket(contract, nonOwner), "game not open");

      await contract.connect(owner).setGameStatus(1, statusEnum.FORCED_CLOSE);
      await expectRevert(() => buyTicket(contract, nonOwner), "game not open");
    });

    it("Should stop a user buying tickets if an outcome is set", async function () {
      await createGame(contract, owner);

      await contract.connect(owner).setGameOutcome(1, directionEnum.POSITIVE);
      await expectRevert(
        () => buyTicket(contract, nonOwner),
        "outcome already set"
      );

      await contract.connect(owner).setGameOutcome(1, directionEnum.NEGATIVE);
      await expectRevert(
        () => buyTicket(contract, nonOwner),
        "outcome already set"
      );
    });

    it("Should stop a user buying tickets if past closesAt", async function () {
      await createGame(contract, owner);

      await setBlockTime(IN_A_WEEK_PLUS_ONE_SECOND);
      await expectRevert(() => buyTicket(contract, nonOwner), "past closesAt");

      await resetNetwork();
    });

    it("Should stop a user buying more tickets than max quantity", async function () {
      await createGame(contract, owner);

      await contract
        .connect(owner)
        .setGameMaxQuantity(
          1,
          NEW_GAME_POSTIVE_MAX_QUANTITY,
          NEW_GAME_NEGATIVE_MAX_QUANTITY
        );

      await expectRevert(
        () =>
          contract
            .connect(nonOwner)
            .buyTickets(1, directionEnum.POSITIVE, 11, GAME_POSITIVE_PRICE),
        "total tickets > ticket limit"
      );
    });

    it("Should stop a user buying if they dont have enough currency", async function () {
      await createGame(contract, owner);

      await expectRevert(
        () => buyTicket(contract, nonOwner),
        "Dai/insufficient-balance"
      );
    });

    it("Should stop a user buying if the supplied price doesnt match the ticket price", async function () {
      await createGame(contract, owner);

      await contract
        .connect(owner)
        .setGamePrices(1, NEW_GAME_POSITIVE_PRICE, NEW_GAME_NEGATIVE_PRICE);

      await expectRevert(
        () => buyTicket(contract, nonOwner),
        "price != ticketPrice"
      );
    });

    it("Should correctly set a user's ticket balance & total spent as well as transfer currency", async function () {
      await createGame(contract, owner);

      const [impersonateWhale, stopImpersonateWhale] = await impersonateAccount(
        DAI_WHALE_ADDRESS
      );

      await impersonateWhale();

      const daiWhaleSigner = ethers.provider.getSigner(DAI_WHALE_ADDRESS);

      const dai = new ethers.Contract(
        DAI_MAINNET_ADDRESS,
        JSON.stringify(daiAbi),
        daiWhaleSigner
      );

      await dai.approve(contract.address, ethers.constants.MaxUint256);

      expect(await dai.balanceOf(contract.address)).to.eq(0);

      await contract
        .connect(daiWhaleSigner)
        .buyTickets(
          1,
          directionEnum.POSITIVE,
          POSITIVE_BUY_AMOUNT,
          GAME_POSITIVE_PRICE
        );

      expect(
        await contract.getBalance(1, DAI_WHALE_ADDRESS, directionEnum.POSITIVE)
      ).to.eq(POSITIVE_BUY_AMOUNT);

      expect(await contract.getTotalSpent(1, DAI_WHALE_ADDRESS)).to.eq(
        POSITIVE_BUY_AMOUNT * GAME_POSITIVE_PRICE
      );

      await contract
        .connect(daiWhaleSigner)
        .buyTickets(
          1,
          directionEnum.NEGATIVE,
          NEGATIVE_BUY_AMOUNT,
          GAME_NEGATIVE_PRICE
        );

      expect(
        await contract.getBalance(1, DAI_WHALE_ADDRESS, directionEnum.NEGATIVE)
      ).to.eq(NEGATIVE_BUY_AMOUNT);

      expect(await contract.getTotalSpent(1, DAI_WHALE_ADDRESS)).to.eq(
        POSITIVE_BUY_AMOUNT * GAME_POSITIVE_PRICE +
          NEGATIVE_BUY_AMOUNT * GAME_NEGATIVE_PRICE
      );

      await contract
        .connect(daiWhaleSigner)
        .buyTickets(
          1,
          directionEnum.POSITIVE,
          POSITIVE_BUY_AMOUNT,
          GAME_POSITIVE_PRICE
        );

      expect(
        await contract.getBalance(1, DAI_WHALE_ADDRESS, directionEnum.POSITIVE)
      ).to.eq(POSITIVE_BUY_AMOUNT + POSITIVE_BUY_AMOUNT);

      stopImpersonateWhale();

      expect(await dai.balanceOf(contract.address)).to.eq(
        ethers.utils.parseUnits(
          (
            POSITIVE_BUY_AMOUNT * GAME_POSITIVE_PRICE * 2 +
            NEGATIVE_BUY_AMOUNT * GAME_NEGATIVE_PRICE
          ).toString(),
          16
        )
      );
    });
  });

  describe(".claimRefund", function () {
    it("Should stop a user claiming a refund when a game is not closed", async function () {
      await createGame(contract, owner);

      await expectRevert(
        () => contract.connect(nonOwner).claimRefund(1),
        "game not cancelled"
      );

      await contract.connect(owner).setGameStatus(1, statusEnum.FORCED_CLOSE);

      await expectRevert(
        () => contract.connect(nonOwner).claimRefund(1),
        "game not cancelled"
      );
    });

    it("Should stop a user claiming if they havent bought any tickets", async function () {
      await createGame(contract, owner);

      await contract.connect(owner).setGameStatus(1, statusEnum.CANCELLED);

      await expectRevert(
        () => contract.connect(nonOwner).claimRefund(1),
        "nothing to claim"
      );
    });

    it("Should refund the correct amount and prevent any further refunds", async function () {
      const daiWhaleSigner = ethers.provider.getSigner(DAI_WHALE_ADDRESS);

      const dai = new ethers.Contract(
        DAI_MAINNET_ADDRESS,
        JSON.stringify(daiAbi),
        daiWhaleSigner
      );

      const daiWhaleBalance = await dai.balanceOf(DAI_WHALE_ADDRESS);

      await createGame(contract, owner);

      const [impersonateWhale, stopImpersonateWhale] = await impersonateAccount(
        DAI_WHALE_ADDRESS
      );

      await impersonateWhale();

      await dai.approve(contract.address, ethers.constants.MaxUint256);

      await contract
        .connect(daiWhaleSigner)
        .buyTickets(
          1,
          directionEnum.POSITIVE,
          POSITIVE_BUY_AMOUNT,
          GAME_POSITIVE_PRICE
        );

      await contract.connect(owner).setGameStatus(1, statusEnum.CANCELLED);

      await contract.connect(daiWhaleSigner).claimRefund(1);

      expect(await dai.balanceOf(DAI_WHALE_ADDRESS)).to.eq(daiWhaleBalance);

      await expectRevert(
        () => contract.connect(daiWhaleSigner).claimRefund(1),
        "nothing to claim"
      );

      stopImpersonateWhale();
    });
  });

  describe(".claimWinnings", function () {
    it("Should stop a user claiming winnings when a game is cancelled", async function () {
      await createGame(contract, owner);

      await contract.connect(owner).setGameStatus(1, statusEnum.CANCELLED);

      await expectRevert(
        () => contract.connect(nonOwner).claimWinnings(1),
        "game cancelled"
      );
    });

    it("Should stop a user claiming winnings when the game's outcome is not set", async function () {
      await createGame(contract, owner);

      await expectRevert(
        () => contract.connect(nonOwner).claimWinnings(1),
        "outcome not set"
      );
    });

    it("Should stop a user claiming winnings when they dont have any winning tickets", async function () {
      await createGame(contract, owner);

      const daiWhaleSigner = ethers.provider.getSigner(DAI_WHALE_ADDRESS);

      const dai = new ethers.Contract(
        DAI_MAINNET_ADDRESS,
        JSON.stringify(daiAbi),
        daiWhaleSigner
      );

      await createGame(contract, owner);

      const [impersonateWhale, stopImpersonateWhale] = await impersonateAccount(
        DAI_WHALE_ADDRESS
      );

      await impersonateWhale();

      await dai.approve(contract.address, ethers.constants.MaxUint256);

      await contract
        .connect(daiWhaleSigner)
        .buyTickets(
          1,
          directionEnum.POSITIVE,
          POSITIVE_BUY_AMOUNT,
          GAME_POSITIVE_PRICE
        );

      await contract.connect(owner).setGameOutcome(1, directionEnum.NEGATIVE);

      await expectRevert(
        () => contract.connect(nonOwner).claimWinnings(1),
        "nothing to claim"
      );
      stopImpersonateWhale();
    });
  });

  it("Should let the user claim the correct winnings and prevent further claims", async function () {
    await createGame(contract, owner);

    const daiWhaleSigner = ethers.provider.getSigner(DAI_WHALE_ADDRESS);

    const dai = new ethers.Contract(
      DAI_MAINNET_ADDRESS,
      JSON.stringify(daiAbi),
      daiWhaleSigner
    );

    const [impersonateWhale, stopImpersonateWhale] = await impersonateAccount(
      DAI_WHALE_ADDRESS
    );

    await impersonateWhale();

    await dai.transfer(contract.address, ethers.utils.parseEther("3"));

    await dai.approve(contract.address, ethers.constants.MaxUint256);

    await contract
      .connect(daiWhaleSigner)
      .buyTickets(
        1,
        directionEnum.POSITIVE,
        POSITIVE_BUY_AMOUNT,
        GAME_POSITIVE_PRICE
      );

    const daiWhaleBalance = (await dai.balanceOf(
      DAI_WHALE_ADDRESS
    )) as BigNumber;

    await contract.connect(owner).setGameOutcome(1, directionEnum.POSITIVE);

    await contract.connect(daiWhaleSigner).claimWinnings(1);

    expect(await dai.balanceOf(DAI_WHALE_ADDRESS)).to.eq(
      daiWhaleBalance.add(
        ethers.utils.parseEther(POSITIVE_BUY_AMOUNT.toString())
      )
    );

    await expectRevert(
      () => contract.connect(daiWhaleSigner).claimWinnings(1),
      "nothing to claim"
    );

    stopImpersonateWhale();
  });

  describe(".withdraw", function () {
    it("Should stop a stranger from withdrawing", async function () {
      await expectRevertSenderIsNotOwner(async () =>
        contract.connect(nonOwner).withdraw(ethers.utils.parseEther("1"))
      );
    });

    it("Should withdraw the correct amount", async function () {
      const daiWhaleSigner = ethers.provider.getSigner(DAI_WHALE_ADDRESS);
      const ownerAddress = await owner.getAddress();

      const dai = new ethers.Contract(
        DAI_MAINNET_ADDRESS,
        JSON.stringify(daiAbi),
        daiWhaleSigner
      );

      const ownerBalance = await dai.balanceOf(ownerAddress);

      const [impersonateWhale, stopImpersonateWhale] = await impersonateAccount(
        DAI_WHALE_ADDRESS
      );

      await impersonateWhale();

      await dai.transfer(contract.address, ethers.utils.parseEther("3"));

      await stopImpersonateWhale();

      const withdrawAmount = ethers.utils.parseEther("1");

      await contract.connect(owner).withdraw(withdrawAmount);

      expect(await dai.balanceOf(ownerAddress)).to.eq(
        ownerBalance.add(withdrawAmount)
      );
    });
  });
});

const expectRevert = async (fn: () => void, message: string) => {
  return (expect(fn()).to.be as any).revertedWith(message);
};

const expectRevertSenderIsNotOwner = (fn: () => void) =>
  expectRevert(fn, "Ownable: caller is not the owner");

export const impersonateAccount = async (address: string) => {
  const startImpersonate = () =>
    network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });

  const stopImpersonate = () =>
    network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [address],
    });

  return [startImpersonate, stopImpersonate];
};

const setBlockTime = async (date: Date) => {
  await network.provider.send("evm_setNextBlockTimestamp", [date.getTime()]);
  await network.provider.send("evm_mine");
};

const resetNetwork = () =>
  network.provider.send("hardhat_reset", [getForkingConfig("jsonRpcUrl")]);
