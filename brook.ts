import { Client, TextChannel, User } from 'discord.js';
import type { Channel } from 'discord.js';
import { BotAPIClient, type ClientResponse } from './botport';

// The hardcoded ID for the Brook bot.
const BROOK_BOT_ID = '1183134058415394846';

/**
 * A dedicated client for interacting with the Brook bot's economy API.
 * 
 * This class provides high-level methods that wrap the underlying botport protocol,
 * making it easy to perform economy actions without worrying about the raw API calls.
 */
export class Brook {
    private apiClient: BotAPIClient;

    /**
     * Creates a new Brook API client instance.
     * 
     * ---
     * 
     * `transportChannel` The channel where the bot will send API requests. All communication happens here.
     * 
     * `client` The discord.js Client instance that will be making the requests.
     */
    constructor(transportChannel: TextChannel, client: Client) {
        this.apiClient = new BotAPIClient(client, BROOK_BOT_ID, {
            transport: transportChannel,
            forceSecure: false,
        });
    }

    /** 
     * Request a payment from a user.
     * 
     * This sends an interactive message to the target user and waits for their response.
     * It is a long-running operation that can take a long time to resolve.
     * 
     * ---
     * 
     * `user` The User object of the person you are requesting payment from.
     * 
     * `amount` The amount of money to request.
     * 
     * `requestChannel` The channel where the interactive payment request message should be sent.
     * 
     * `description` A string explaining the reason for the payment request, which will be shown to the user.
     */
    async requestPayment(user: User, amount: number, requestChannel: Channel, description: string): Promise<any> {
        console.log(`Requesting payment of ${amount} from ${user.tag}...`);

        const onUpdate = (update: ClientResponse) => {
            console.log(`[Brook API Update] Status ${update.status}: ${update.body.message}`);
        };

        const finalResponse = await this.apiClient.post(
            `/payrequest/${user.id}?amount=${amount}&channel=${requestChannel.id}`,
            {
                body: { description },
                onUpdate: onUpdate
            }
        );

        if (finalResponse.body.type === 'accepted') {
            return finalResponse.body.paymentInfo;
        } else {
            throw new Error(`Payment request failed: ${finalResponse.body.message}`);
        }
    }

    /** 
     * Pay a user or an organization.
     * 
     * This immediately transfers funds from the client's account to the target.
     * 
     * ---
     * 
     * `target` A User object or a string ID representing the recipient (can be a user or an organization).
     * 
     * `amount` The amount of money to pay.
     */
    async pay(target: User | string, amount: number): Promise<any> {
        const targetId = typeof target === 'string' ? target : target.id;

        const response = await this.apiClient.post(
            `/pay/${targetId}?amount=${amount}`
        );

        return response.body.details;
    }

    /** 
     * Get the current balance of a user or organization.
     * 
     * ---
     * 
     * `target` A User object or a string ID representing the account to check.
     */
    async balance(target: User | string): Promise<number> {
        const targetId = typeof target === 'string' ? target : target.id;

        const response = await this.apiClient.get(
            `/balance/${targetId}`
        );

        return response.body.balance;
    }
}