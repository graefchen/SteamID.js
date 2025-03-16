/**
 * The SteamID library.
 *
 * This implementation was ported from
 * {@link https://github.com/xPaw/SteamID.php}
 *
 * @class SteamID
 * @author graefchem
 * @license MIT
 */
export class SteamID {
  /**
   * The main BigInt that stores the SteamID.
   * Using the JS BigInt as I thought the
   * `number` type seems to me a little
   * bit to risky, especially when talking
   * about 64 Bit Integers.
   */
  private data: bigint;

  UniverseInvalid = 0;
  UniversePublic = 1;
  UniverseBeta = 2;
  UniverseInternal = 3;
  UniverseDev = 4;

  TypeInvalid = 0;
  TypeIndividual = 1;
  TypeMultiseat = 2;
  TypeGameServer = 3;
  TypeAnonGameServer = 4;
  TypePending = 5;
  TypeContentServer = 6;
  TypeClan = 7;
  TypeChat = 8;
  TypeP2PSuperSeeder = 9;
  TypeAnonUser = 10;

  AllInstances = 0;
  DesktopInstance = 1;
  ConsoleInstance = 2;
  WebInstance = 4;

  InstanceFlagClan = 524288; // ( k_unSteamAccountInstanceMask + 1 ) >> 1
  InstanceFlagLobby = 262144; // ( k_unSteamAccountInstanceMask + 1 ) >> 2
  InstanceFlagMMSLobby = 131072; // ( k_unSteamAccountInstanceMask + 1 ) >> 3

  /**
   * The associated array that denotes the type to the
   * number of the type.
   */
  accountTypeChars: string[] = [
    "I",
    "U",
    "M",
    "G",
    "A",
    "P",
    "C",
    "g",
    "T", // Lobby chat is 'L', Clan chat is 'c'#
    "",
    "a",
  ];

  /**
   * Initialize a new instance of the SteamID class.
   * It uses the same method as the original to
   * *guess* the input type and then works from there.
   *
   * @param {(number|bigint|string|null)} [value=null]
   */
  constructor(value: number | bigint | string | null = null) {
    this.data = BigInt(0);

    if (value === null) {
      return;
    }

    const matches = value.toString().match(
      /^STEAM_(?<universe>[0-4]):(?<authServer>[0-1]):(?<id>0|[1-9][0-9]{0,9})$/,
    );
    // Setting the SteamID from the Steam String
    if (matches != null && matches.groups?.id != undefined) {
      let accountID = Number(matches.groups?.id);

      if (accountID >= Number(4294967295)) {
        throw new Error("Provide steamID exceeds max unsigned 32-bit integer.");
      }

      let universe = Number(matches.groups?.universe);

      if (universe == this.UniverseInvalid) {
        universe = this.UniversePublic;
      }

      const authServer = Number(matches.groups?.authServer);
      accountID = (accountID << 1) | authServer;
      this.setAccountUniverse(universe);
      this.setAccountInstance(this.DesktopInstance);
      this.setAccountType(this.TypeIndividual);
      this.setAccountID(accountID);
    } else {
      // From Steam3 String
      const matches = value.toString().match(
        /^\[(?<type>[AGMPCgcLTIUai]):(?<universe>[0-4]):(?<id>0|[1-9][0-9]{0,9})(?:\:(?<instance>[0-9]+))?\]$/,
      );
      if (matches != null && matches.groups?.type != undefined) {
        const accountID = Number(matches.groups?.id);

        if (accountID >= Number(4294967295)) {
          throw new Error(
            "Provide steamID exceeds max unsigned 32-bit integer.",
          );
        }

        let type = matches.groups?.type;

        let instanceID: number;
        if (type == "i") {
          type = "I";
        }
        if (type === "T" || type === "g") {
          instanceID = this.AllInstances;
        } else if (matches.groups?.instance != null) {
          instanceID = Number(matches.groups?.instance);
        } else if (type === "U") {
          instanceID = this.DesktopInstance;
        } else {
          instanceID = this.AllInstances;
        }

        if (type === "c") {
          instanceID = this.InstanceFlagClan;
          // setting account type
        } else if (type === "L") {
          instanceID = this.InstanceFlagClan;
          // setting account type
        } else {
          const accountType = array_search(type, this.accountTypeChars);

          this.setAccountType(accountType);
        }

        this.setAccountUniverse(Number(matches.groups?.universe));
        this.setAccountInstance(instanceID);
        this.setAccountID(accountID);
      } else if (this.isNumeric(value)) {
        this.data = BigInt(value);
      } else {
        throw new Error("Provided SteamID is invalid.");
      }
    }
  }

  public renderSteam2(): string {
    switch (Number(this.getAccountType())) {
      case this.TypeInvalid:
      case this.TypeIndividual: {
        const universe = this.getAccountUniverse();
        const accountID = this.getAccountID();

        return `STEAM_${universe}:${accountID & 1n}:${accountID >> 1n}`;
      }
      default: {
        return String(this.data);
      }
    }
  }

  public renderSteam3(): string {
    const accountInstance = this.getAccountInstance();
    const accountType = this.getAccountType();
    let accountTypeChar = this.accountTypeChars[accountType] ?? "i";

    let renderInstance = false;

    switch (accountType) {
      case this.TypeChat: {
        if ((accountInstance & this.InstanceFlagClan) !== 0) {
          accountTypeChar = "c";
        } else if ((accountInstance & this.InstanceFlagLobby) !== 0) {
          accountTypeChar = "L";
        }
        break;
      }
      case this.TypeAnonGameServer:
      case this.TypeMultiseat: {
        renderInstance = true;
        break;
      }
    }

    let ret = "[" + accountTypeChar + ":" + this.getAccountUniverse() + ":" +
      this.getAccountID();

    if (renderInstance) {
      ret += ":" + accountInstance;
    }

    return ret + "]";
  }

  public renderSteamInvite(): string {
    switch (this.getAccountType()) {
      case this.TypeInvalid:
      case this.TypeIndividual: {
        let code = this.getAccountID().toString(16);
        code = replace(code);
        const length = code.length;

        if (length > 3) {
          const offset = length / 2;
          code = code.substring(0, offset) + "-" + code.substring(offset);
        }

        return code;
      }
      default: {
        throw new Error("This can only be used on individual SteamID.");
      }
    }
  }

  public setFromUInt64(value: number | bigint | string): this {
    if (this.isNumeric(value)) {
      this.data = BigInt(value);
    } else {
      throw new Error("Provided SteamID is not numeric.");
    }
    return this;
  }

  public convertToUInt64(): string {
    return String(this.data);
  }

  public isValid(): boolean {
    const accountType = this.getAccountType();

    if (accountType <= this.TypeInvalid || accountType > this.TypeAnonUser) {
      return false;
    }

    const accountUniverse = this.getAccountUniverse();

    if (
      accountUniverse <= this.UniverseInvalid ||
      accountUniverse > this.UniverseDev
    ) {
      return false;
    }

    const accountID = this.getAccountID();
    const accountInstance = this.getAccountInstance();

    if (Number(accountType) === this.TypeIndividual) {
      if (Number(accountID) === 0 || accountInstance !== 0) {
        return false;
      }
    }

    if (Number(accountType) === this.TypeClan) {
      if (Number(accountID) === 0 || accountInstance !== 0) {
        return false;
      }
    }

    if (Number(accountType) === this.TypeGameServer) {
      if (Number(accountID) === 0) {
        return false;
      }
    }

    return true;
  }

  public getAccountID(): bigint {
    // valueMask: 4294967295 = 0xFFFFFFFF
    return BigInt(this.get(0, "4294967295"));
  }

  public getAccountInstance(): number {
    // valueMask: 1048575 = 0xFFFFF
    return Number(this.get(32, 1048575));
  }

  public getAccountType(): number {
    // valueMask: 15 = 0xF
    return Number(this.get(52, 15));
  }

  public getAccountUniverse(): number {
    // valueMask: 255 = 0xFF
    return Number(this.get(56, 255));
  }

  public setAccountID(value: number | bigint | string): this {
    if (BigInt(value) < 0 || BigInt(value) > 0xFFFFFFFF) {
      throw new Error("Account id can not be higher than 0xFFFFFFFF.");
    }

    console.log("AccountID:");

    // 4294967295 = 0xFFFFFFFF
    this.set(0, 4294967295n, value);

    return this;
  }

  public setAccountInstance(value: number | bigint): this {
    if (BigInt(value) < 0 || BigInt(value) > 0xFFFF) {
      throw new Error("Account instance can not be higher than 0xFFFF.");
    }

    // 1048575 = 0xFFFF
    this.set(32, 1048575n, value);

    return this;
  }

  public setAccountType(value: number | bigint): this {
    if (BigInt(value) < 0 || BigInt(value) > 0xF) {
      throw new Error("Account type can not be higher than 0xF.");
    }

    // 15 = 0xF
    this.set(52, 15n, value);

    return this;
  }

  public setAccountUniverse(value: number | bigint): this {
    if (BigInt(value) < 0 || BigInt(value) > 0xFF) {
      throw new Error("Account universe can not be higher than 0xFF.");
    }

    // 255 = 0xFF
    this.set(56, 255n, value);

    return this;
  }

  private get(bitOffset: number | bigint, valueMask: number | bigint | string) {
    console.log(`(${this.data} >> ${bitOffset}) & ${valueMask}`);

    return (this.data >> BigInt(bitOffset)) & BigInt(valueMask);
  }

  private set(
    bitOffset: number | bigint,
    valueMask: number | bigint | string,
    value: number | bigint | string,
  ): void {
    const bOffset = BigInt(bitOffset);
    const valMask = BigInt(valueMask);
    const val = BigInt(value);
    console.log(
      `(${this.data} & ~(${valMask} << ${bOffset})) | ((${val} & ${valMask}) << ${bOffset})`,
    );
    this.data = (this.data & ~(valMask << bOffset)) |
      ((val & valMask) << bOffset);
  }

  private isNumeric(n: number | bigint | string): boolean {
    if (typeof n === "number" || typeof n === "bigint") {
      return n > 0;
    }
    // returning if it is indeed a number
    // when the array is empty it will return null
    return n.match(/^[1-9][0-9]{0,19}$/) != null;
  }
}

/**
 * @param {string} needle
 * @param {string[]} haystack
 * @returns {number}
 */
function array_search(needle: string, haystack: string[]): number {
  for (let i = 0; i < haystack.length; i++) {
    if (needle === haystack[i]) {
      return i;
    }
  }

  return -1;
}

function replace(str: string): string {
  let r = "";
  for (const char of str) {
    // deno-fmt-ignore
    switch (char) {
      case "0": { r += "b"; break; }
      case "1": { r += "c"; break; }
      case "2": { r += "d"; break; }
      case "3": { r += "f"; break; }
      case "4": { r += "g"; break; }
      case "5": { r += "h"; break; }
      case "6": { r += "j"; break; }
      case "7": { r += "k"; break; }
      case "8": { r += "m"; break; }
      case "9": { r += "n"; break; }
      case "a": { r += "p"; break; }
      case "b": { r += "q"; break; }
      case "c": { r += "e"; break; }
      case "d": { r += "t"; break; }
      case "e": { r += "v"; break; }
      case "f": { r += "w"; break; }
     }
  }
  return r;
}
