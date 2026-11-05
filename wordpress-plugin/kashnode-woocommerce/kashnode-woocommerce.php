<?php
/**
 * Plugin Name: KashNode WooCommerce Connector
 * Description: Sends newly processed WooCommerce orders to KashNode for phone verification and AI calling.
 * Version: 1.0.0
 * Requires PHP: 7.4
 * Text Domain: kashnode-woocommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class KashNode_WooCommerce_Connector {
	const OPTION_NAME = 'kashnode_woocommerce_settings';
	const SETTINGS_GROUP = 'kashnode_woocommerce_settings_group';
	const MENU_SLUG = 'kashnode-woocommerce';

	/**
	 * Prevent duplicate requests when a checkout implementation fires more
	 * than one supported order-processed action during the same PHP request.
	 *
	 * @var array<int, bool>
	 */
	private static $sent_orders = array();

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );

		// Classic shortcode checkout.
		add_action(
			'woocommerce_checkout_order_processed',
			array( $this, 'handle_classic_checkout' ),
			20,
			3
		);

		// WooCommerce Checkout Block / Store API.
		add_action(
			'woocommerce_store_api_checkout_order_processed',
			array( $this, 'handle_store_api_checkout' ),
			20,
			1
		);
	}

	public function add_settings_page() {
		add_submenu_page(
			'woocommerce',
			__( 'KashNode Integration', 'kashnode-woocommerce' ),
			__( 'KashNode', 'kashnode-woocommerce' ),
			'manage_woocommerce',
			self::MENU_SLUG,
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings() {
		register_setting(
			self::SETTINGS_GROUP,
			self::OPTION_NAME,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
				'default'           => array(),
			)
		);
	}

	/**
	 * Validate settings without ever re-rendering the saved secret in HTML.
	 *
	 * @param mixed $input Submitted settings.
	 * @return array<string, string>
	 */
	public function sanitize_settings( $input ) {
		$input    = is_array( $input ) ? $input : array();
		$existing = get_option( self::OPTION_NAME, array() );
		$existing = is_array( $existing ) ? $existing : array();

		$url = isset( $input['webhook_url'] )
			? esc_url_raw( trim( (string) $input['webhook_url'] ), array( 'https' ) )
			: '';

		if ( '' !== $url ) {
			$parts = wp_parse_url( $url );
			if ( ! is_array( $parts ) || empty( $parts['host'] ) || 'https' !== strtolower( $parts['scheme'] ?? '' ) ) {
				add_settings_error(
					self::OPTION_NAME,
					'kashnode_invalid_webhook_url',
					__( 'Enter a valid HTTPS KashNode webhook URL.', 'kashnode-woocommerce' )
				);
				$url = isset( $existing['webhook_url'] ) ? (string) $existing['webhook_url'] : '';
			}
		}

		$submitted_secret = isset( $input['secret_key'] )
			? trim( (string) $input['secret_key'] )
			: '';

		$secret = isset( $existing['secret_key'] ) ? (string) $existing['secret_key'] : '';
		if ( '' !== $submitted_secret ) {
			if (
				strlen( $submitted_secret ) < 32
				|| strlen( $submitted_secret ) > 255
				|| ! preg_match( '/^[A-Za-z0-9._~-]+$/', $submitted_secret )
			) {
				add_settings_error(
					self::OPTION_NAME,
					'kashnode_invalid_secret',
					__( 'The secret key must be 32–255 characters and use only letters, numbers, dot, underscore, tilde or hyphen.', 'kashnode-woocommerce' )
				);
			} else {
				$secret = $submitted_secret;
			}
		}

		return array(
			'webhook_url' => $url,
			'secret_key'  => $secret,
		);
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		$settings     = get_option( self::OPTION_NAME, array() );
		$settings     = is_array( $settings ) ? $settings : array();
		$secret_saved = ! empty( $settings['secret_key'] );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'KashNode WooCommerce Integration', 'kashnode-woocommerce' ); ?></h1>
			<p><?php esc_html_e( 'Send each newly processed WooCommerce order to your KashNode workspace.', 'kashnode-woocommerce' ); ?></p>

			<?php settings_errors( self::OPTION_NAME ); ?>

			<form method="post" action="options.php">
				<?php settings_fields( self::SETTINGS_GROUP ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">
							<label for="kashnode-webhook-url"><?php esc_html_e( 'KashNode Webhook URL', 'kashnode-woocommerce' ); ?></label>
						</th>
						<td>
							<input
								type="url"
								class="regular-text"
								id="kashnode-webhook-url"
								name="<?php echo esc_attr( self::OPTION_NAME ); ?>[webhook_url]"
								value="<?php echo esc_attr( $settings['webhook_url'] ?? '' ); ?>"
								placeholder="https://your-kashnode-host/api/webhooks/woocommerce"
								autocomplete="url"
								required
							/>
							<p class="description"><?php esc_html_e( 'Use the HTTPS endpoint shown in your KashNode merchant settings.', 'kashnode-woocommerce' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="kashnode-secret-key"><?php esc_html_e( 'Secret Key', 'kashnode-woocommerce' ); ?></label>
						</th>
						<td>
							<input
								type="password"
								class="regular-text"
								id="kashnode-secret-key"
								name="<?php echo esc_attr( self::OPTION_NAME ); ?>[secret_key]"
								value=""
								autocomplete="new-password"
								placeholder="<?php echo esc_attr( $secret_saved ? __( 'Saved — leave blank to keep the current key', 'kashnode-woocommerce' ) : __( 'Paste your KashNode merchant webhook secret', 'kashnode-woocommerce' ) ); ?>"
								<?php echo $secret_saved ? '' : 'required'; ?>
							/>
							<p class="description">
								<?php
								echo $secret_saved
									? esc_html__( 'A secret is saved. It is never displayed here; leave this field blank to keep it unchanged.', 'kashnode-woocommerce' )
									: esc_html__( 'Paste the webhook secret generated for this merchant in KashNode.', 'kashnode-woocommerce' );
								?>
							</p>
						</td>
					</tr>
				</table>
				<?php submit_button( __( 'Save KashNode Settings', 'kashnode-woocommerce' ) ); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * Classic checkout action.
	 *
	 * @param int   $order_id   WooCommerce order ID.
	 * @param array $posted_data Checkout form data.
	 * @param mixed $order      Optional WC_Order instance.
	 */
	public function handle_classic_checkout( $order_id, $posted_data = array(), $order = null ) {
		if ( ! $order instanceof WC_Order && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
		}
		$this->send_order_to_kashnode( $order );
	}

	/**
	 * Checkout Block / Store API action.
	 *
	 * @param mixed $order WooCommerce order.
	 */
	public function handle_store_api_checkout( $order ) {
		$this->send_order_to_kashnode( $order );
	}

	/**
	 * Build a minimal order payload and POST it with both the shared secret
	 * and WooCommerce-compatible HMAC-SHA256 signature.
	 *
	 * @param mixed $order WooCommerce order.
	 */
	private function send_order_to_kashnode( $order ) {
		if ( ! $order instanceof WC_Order ) {
			return;
		}

		$order_id = (int) $order->get_id();
		if ( $order_id <= 0 || isset( self::$sent_orders[ $order_id ] ) ) {
			return;
		}

		$settings = get_option( self::OPTION_NAME, array() );
		$settings = is_array( $settings ) ? $settings : array();
		$url      = isset( $settings['webhook_url'] ) ? trim( (string) $settings['webhook_url'] ) : '';
		$secret   = isset( $settings['secret_key'] ) ? (string) $settings['secret_key'] : '';

		$url_parts = wp_parse_url( $url );
		if (
			'' === $url
			|| '' === $secret
			|| ! is_array( $url_parts )
			|| empty( $url_parts['host'] )
			|| 'https' !== strtolower( $url_parts['scheme'] ?? '' )
		) {
			return;
		}

		$line_items = array();
		foreach ( $order->get_items( 'line_item' ) as $item_id => $item ) {
			$product = $item->get_product();

			$line_items[] = array(
				'id'           => (string) $item_id,
				'product_id'   => (string) $item->get_product_id(),
				'variation_id' => (string) $item->get_variation_id(),
				'name'         => (string) $item->get_name(),
				'sku'          => $product ? (string) $product->get_sku() : '',
				'quantity'     => (int) $item->get_quantity(),
				'subtotal'     => (string) $item->get_subtotal(),
				'total'        => (string) $item->get_total(),
			);
		}

		$customer_name = trim(
			(string) $order->get_billing_first_name() . ' ' . (string) $order->get_billing_last_name()
		);

		$payload = array(
			'id'                    => (string) $order_id,
			'platform_order_id'     => (string) $order_id,
			'customer_name'         => $customer_name,
			'customer_phone'        => (string) $order->get_billing_phone(),
			'total_amount'          => (string) $order->get_total(),
			'currency'              => (string) $order->get_currency(),
			'payment_method'        => (string) $order->get_payment_method(),
			'payment_method_title'  => (string) $order->get_payment_method_title(),
			// Only WooCommerce's authoritative paid state may be sent as paid.
			'payment_status'        => $order->is_paid() ? 'paid' : 'unpaid',
			'line_items'            => $line_items,
		);

		$body = wp_json_encode( $payload );
		if ( ! is_string( $body ) ) {
			$this->log( 'Order ' . $order_id . ': failed to encode the order payload.', 'error' );
			return;
		}

		$signature = base64_encode( hash_hmac( 'sha256', $body, $secret, true ) );

		$response = wp_remote_post(
			$url,
			array(
				'timeout'             => 15,
				'redirection'         => 0,
				'blocking'            => true,
				'sslverify'           => true,
				'headers'             => array(
					'Content-Type'               => 'application/json',
					'Accept'                     => 'application/json',
					'X-KashNode-Webhook-Secret'  => $secret,
					'X-WC-Webhook-Signature'     => $signature,
				),
				'body'                => $body,
				'data_format'         => 'body',
			)
		);

		if ( is_wp_error( $response ) ) {
			$this->log(
				'Order ' . $order_id . ': webhook request failed (' . $response->get_error_code() . ').',
				'error'
			);
			return;
		}

		$status_code = (int) wp_remote_retrieve_response_code( $response );
		if ( $status_code < 200 || $status_code >= 300 ) {
			$this->log(
				'Order ' . $order_id . ': KashNode returned HTTP ' . $status_code . '.',
				'error'
			);
			return;
		}

		self::$sent_orders[ $order_id ] = true;
		$this->log( 'Order ' . $order_id . ' was accepted by KashNode.' );
	}

	/**
	 * Log outcomes without order payloads, phone numbers or credentials.
	 *
	 * @param string $message Log message.
	 * @param string $level   WooCommerce log level.
	 */
	private function log( $message, $level = 'info' ) {
		if ( function_exists( 'wc_get_logger' ) ) {
			wc_get_logger()->log(
				$level,
				$message,
				array( 'source' => 'kashnode-woocommerce' )
			);
		}
	}
}

add_action(
	'plugins_loaded',
	static function () {
		if ( ! class_exists( 'WooCommerce' ) ) {
			if ( is_admin() ) {
				add_action(
					'admin_notices',
					static function () {
						echo '<div class="notice notice-warning"><p>' .
							esc_html__( 'KashNode WooCommerce Connector requires WooCommerce to be active.', 'kashnode-woocommerce' ) .
							'</p></div>';
					}
				);
			}
			return;
		}

		new KashNode_WooCommerce_Connector();
	},
	20
);
